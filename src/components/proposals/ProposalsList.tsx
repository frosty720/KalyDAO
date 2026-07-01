import React, { useState, useEffect } from "react";
import { Search, Filter, ArrowUpDown, Loader2 } from "lucide-react";
import ProposalCard from "./ProposalCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useChainId, useAccount, useBlockNumber } from "wagmi";
import { isSpecialProposal } from "@/lib/proposalVotes";
import { getDaoSubgraphUrl, queryProposalTotals } from "@/lib/daoSubgraph";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type ProposalState = "Pending" | "Active" | "Canceled" | "Defeated" | "Succeeded" | "Queued" | "Expired" | "Executed";

interface Proposal {
  id: string;
  title: string;
  description: string;
  summary?: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotes: number;
  timeRemaining?: string;
  deadlineBlock: number;
  status: "active" | "passed" | "failed" | "pending" | "queued" | "executed";
  createdAt: string;
  category?: string;
}

interface ProposalsListProps {
  proposals?: Proposal[];
  title?: string;
  showFilters?: boolean;
}

// Time remaining from BLOCK NUMBERS. `deadline_timestamp` in Supabase is the deadline
// BLOCK (proposalDeadline()), not unix time — compare to the current block. (~2s blocks.)
const calculateTimeRemaining = (deadlineBlock: number, currentBlock: number): string => {
  if (!deadlineBlock || !currentBlock) return "";
  const blocksRemaining = deadlineBlock - currentBlock;
  if (blocksRemaining <= 0) return "Ended";

  const remainingSeconds = blocksRemaining * 2;
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''} left`;
  } else {
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''} left`;
  }
};

// Map database status to UI status
const mapStateToStatus = (state: ProposalState): "active" | "passed" | "failed" | "pending" | "queued" | "executed" => {
  switch (state) {
    case "Active":
      return "active";
    case "Succeeded":
      return "passed";
    case "Defeated":
      return "failed";
    case "Pending":
      return "pending";
    case "Queued":
      return "queued";
    case "Executed":
      return "executed";
    case "Expired":
      return "failed";
    case "Canceled":
      return "failed";
    default:
      return "pending";
  }
};

const ProposalsList = ({
  title = "All Proposals",
  showFilters = true,
}: ProposalsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "mostVotes">("newest");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const walletChainId = useChainId();
  const { isConnected } = useAccount();
  // Default to mainnet (3888) when no wallet is connected.
  const chainId = isConnected ? walletChainId : 3888;
  const { data: currentBlockData } = useBlockNumber({ chainId, watch: true });
  const currentBlock = Number(currentBlockData || 0);

  // Fetch proposals from Supabase
  useEffect(() => {
    const fetchProposals = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching proposals for chain ID:', chainId);
        const { data, error } = await supabase
          .from('proposals')
          .select('*')
          .eq('chain_id', chainId)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching proposals:', error);
          setError(error.message);
          toast({
            title: 'Error fetching proposals',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }
        
        console.log('Fetched proposals:', data);

        // Overlay accurate vote totals from the DAO subgraph (on-chain truth). Testnet
        // (no subgraph) keeps Supabase; special P1/P2 keep their injected values.
        const subUrl = getDaoSubgraphUrl(chainId);
        const totalsMap = new Map<string, { for: number; against: number; abstain: number }>();
        if (subUrl) {
          const totals = await queryProposalTotals(subUrl);
          for (const t of totals) {
            totalsMap.set(t.proposalId, {
              for: Number(t.forVotes) / 1e18,
              against: Number(t.againstVotes) / 1e18,
              abstain: Number(t.abstainVotes) / 1e18,
            });
          }
        }

        // Transform Supabase data to our component format
        const transformedProposals: Proposal[] = data.map(item => {
          const sg = isSpecialProposal(item.proposal_id) ? undefined : totalsMap.get(item.proposal_id);
          const votesFor = sg ? sg.for : (item.votes_for || 0);
          const votesAgainst = sg ? sg.against : (item.votes_against || 0);
          const votesAbstain = sg ? sg.abstain : (item.votes_abstain || 0);
          const totalVotes = votesFor + votesAgainst + votesAbstain;

          // Calculate time remaining if we have a deadline
          const deadlineBlock = Number(item.deadline_timestamp) || 0;

          return {
            id: item.proposal_id,
            title: item.title,
            description: item.description,
            summary: item.summary,
            votesFor,
            votesAgainst,
            votesAbstain,
            totalVotes,
            deadlineBlock,
            // Legacy proposals #1/#2 always display as Passed (see proposalVotes.ts).
            status: isSpecialProposal(item.proposal_id)
              ? 'passed'
              : mapStateToStatus(item.state as ProposalState),
            createdAt: item.created_at,
            category: item.category,
          };
        });
        
        setProposals(transformedProposals);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'An unknown error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProposals();

    // Realtime: re-fetch when proposals change so new/updated proposals appear
    // without a manual page refresh.
    const channel = supabase
      .channel(`all-proposals-${chainId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals', filter: `chain_id=eq.${chainId}` },
        () => fetchProposals(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chainId, toast]);

  // Filter proposals based on search term and status
  const filteredProposals = proposals.filter((proposal) => {
    const matchesSearch =
      proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (proposal.description && proposal.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (proposal.summary && proposal.summary.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus =
      statusFilter === "all" || proposal.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Sort proposals based on sort order
  const sortedProposals = [...filteredProposals].sort((a, b) => {
    if (sortOrder === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortOrder === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      // mostVotes
      return b.totalVotes - a.totalVotes;
    }
  });

  return (
    <div className="w-full max-w-7xl mx-auto bg-card p-6 rounded-lg shadow-sm">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search proposals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="executed">Executed</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                    Newest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                    Oldest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("mostVotes")}>
                    Most Votes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading proposals...</p>
          </div>
        ) : sortedProposals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                id={proposal.id}
                title={proposal.title}
                description={proposal.description || proposal.summary || ""}
                votesFor={proposal.votesFor}
                votesAgainst={proposal.votesAgainst}
                votesAbstain={proposal.votesAbstain}
                totalVotes={proposal.totalVotes}
                timeRemaining={calculateTimeRemaining(proposal.deadlineBlock, currentBlock)}
                status={proposal.status}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              No proposals found
            </h3>
            <p className="text-muted-foreground mt-2">
              {searchTerm || statusFilter !== 'all'
                ? "Try adjusting your search or filters"
                : "There are no proposals at this time"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProposalsList;
