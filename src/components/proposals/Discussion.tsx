import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  proposal_id: string;
  user_address: string;
  content: string;
  created_at: string;
}

interface DiscussionProps {
  proposalId: string;
}

export const Discussion = ({ proposalId }: DiscussionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { address, isConnected } = useAccount();

  console.log('Discussion component rendered with proposalId:', proposalId);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      console.log('Fetching comments for proposal:', proposalId);
      
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }

      console.log('Fetched comments:', data);
      setComments(data || []);
    };

    fetchComments();

    // Subscribe to new comments
    const subscription = supabase
      .channel('comments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `proposal_id=eq.${proposalId}`
      }, (payload) => {
        console.log('Received realtime update:', payload);
        if (payload.eventType === 'INSERT') {
          setComments(prev => [payload.new as Comment, ...prev]);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [proposalId]);

  // Submit new comment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !newComment.trim()) return;

    console.log('Submitting comment for proposal:', proposalId);
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          proposal_id: proposalId,
          user_address: address,
          content: newComment.trim()
        })
        .select();

      if (error) throw error;
      console.log('Comment submitted successfully:', data);
      setNewComment('');
      
      // Immediately add the new comment to the list
      if (data && data[0]) {
        setComments(prev => [data[0], ...prev]);
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  console.log('Current comments state:', comments);

  return (
    <div className="space-y-6">
      {/* Comment form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder={isConnected ? "Share your thoughts..." : "Connect wallet to comment"}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={!isConnected || isSubmitting}
          className="min-h-[100px]"
        />
        <Button 
          type="submit"
          disabled={!isConnected || !newComment.trim() || isSubmitting}
          className="w-full sm:w-auto"
        >
          Post Comment
        </Button>
      </form>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-secondary p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {formatAddress(comment.user_address).slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">
                  {formatAddress(comment.user_address)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap">{comment.content}</p>
          </div>
        ))}
        
        {comments.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </div>
    </div>
  );
}; 