import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});

// Types for our database
export type ProposalMetadata = {
  id: string;
  proposal_id: string;
  title: string;
  description: string;
  summary?: string;
  proposer_address: string;
  created_at: string;
  updated_at: string;
  state: string;
  snapshot_timestamp?: number;
  deadline_timestamp?: number;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  category?: string;
  tags?: string[];
  views_count: number;
  metadata?: Record<string, any>;
};

// New type for vote history
export type VoteHistoryItem = {
  id?: string;
  proposal_id: string;
  voter_address: string;
  support: 0 | 1 | 2; // 0=against, 1=for, 2=abstain
  voting_power: number;
  reason?: string;
  transaction_hash: string;
  block_number: number;
  timestamp?: string;
  network_id: number;
  created_at?: string;
  updated_at?: string;
};

// Helper functions for proposals
export const proposalQueries = {
  async createProposal(data: Omit<ProposalMetadata, 'id' | 'created_at' | 'updated_at'>) {
    console.log('Attempting to create proposal:', data.proposal_id);
    
    const { data: proposal, error } = await supabase
      .from('proposals')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error creating proposal:', error);
      if (error.code === '42501') {
        console.error('PERMISSION DENIED: Check RLS policies for INSERT permission on proposals table');
      }
      throw error;
    }
    
    console.log('Proposal created successfully:', proposal.proposal_id);
    return proposal;
  },

  async getProposal(proposalId: string) {
    const { data: proposal, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('proposal_id', proposalId)
      .single();

    if (error) throw error;
    return proposal;
  },

  async updateProposalState(proposalId: string, state: string) {
    const { data: proposal, error } = await supabase
      .from('proposals')
      .update({ state })
      .eq('proposal_id', proposalId)
      .select()
      .single();

    if (error) throw error;
    return proposal;
  },

  async updateProposalVotes(
    proposalId: string,
    votes: { votes_for: number; votes_against: number; votes_abstain: number }
  ) {
    const { data: proposal, error } = await supabase
      .from('proposals')
      .update(votes)
      .eq('proposal_id', proposalId)
      .select()
      .single();

    if (error) throw error;
    return proposal;
  },

  async incrementViewCount(proposalId: string) {
    const { data: proposal, error } = await supabase.rpc('increment_proposal_views', {
      p_proposal_id: proposalId
    });

    if (error) throw error;
    return proposal;
  },
}; 