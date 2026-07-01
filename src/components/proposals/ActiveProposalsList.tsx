import React, { useState, useEffect } from "react";
import { Search, Filter, ArrowUpDown, Loader2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
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

interface ActiveProposalsListProps {
  title?: string;
  showFilters?: boolean;
  limit?: number;
}

// Time remaining from BLOCK NUMBERS. `deadline_timestamp` in Supabase is actually
// the proposal's deadline BLOCK (from proposalDeadline()), not a unix timestamp — so
// we compare it to the current block, not Date.now(). (~2s KalyChain blocks.)
const calculateTimeRemaining = (deadlineBlock: number, currentBlock: number): string => {
  if (!deadlineBlock || !currentBlock) return "";
  const blocksRemaining = deadlineBlock - currentBlock;
  if (blocksRemaining <= 0) return "Ended";

  const remainingSeconds = blocksRemaining * 2;
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''} left`;
  }
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''} left`;
};

// Map database status to UI status
const mapStateToStatus = (state: string): "active" | "passed" | "failed" | "pending" | "queued" | "executed" => {
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

const ActiveProposalsList = ({
  title = "Active Proposals",
  showFilters = true,
  limit = 3
}: ActiveProposalsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "mostVotes">("newest");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showingRecentProposals, setShowingRecentProposals] = useState<boolean>(false);
  const { toast } = useToast();
  const walletChainId = useChainId();
  const { isConnected } = useAccount();
  // When no wallet is connected, default to mainnet (3888) instead of whatever the
  // wagmi config last persisted (which could be testnet).
  const chainId = isConnected ? walletChainId : 3888;
  // Current block on the active chain — used to turn deadline BLOCK numbers into
  // real "time remaining" (deadline_timestamp is a block number, not unix time).
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

        // Overlay accurate vote totals from the DAO subgraph (on-chain truth). Supabase
        // no longer counts votes. Only mainnet has a subgraph; testnet keeps Supabase.
        // Special P1/P2 keep their injected display values (never overlaid).
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
          // Store the deadline BLOCK; compute the human string at render (below) so
          // it stays correct as blocks advance without re-querying Supabase.
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
            status: isSpecialProposal(item.proposal_id) ? 'passed' : mapStateToStatus(item.state),
            createdAt: item.created_at,
            category: item.category,
          };
        });
        
        setProposals(transformedProposals);
        
        // Check if there are any active proposals
        const activeProposals = transformedProposals.filter(p => p.status === "active");
        setShowingRecentProposals(activeProposals.length === 0);
        
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

    // Realtime: re-fetch when proposals change so newly created/updated proposals
    // appear without a manual page refresh.
    const channel = supabase
      .channel(`active-proposals-${chainId}`)
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
    
    // Show ALL statuses when: no active proposals exist (recent fallback), OR this is
    // the compact home embed (showFilters=false) — the home showcases the latest
    // proposals regardless of status, so Passed ones (e.g. P1/P2) stay visible.
    const matchesStatus = (showingRecentProposals || !showFilters)
      ? true
      : statusFilter === "all" || proposal.status === statusFilter;

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

  // Limit the number of proposals to display
  const displayProposals = sortedProposals.slice(0, limit);

  // "Recent Proposals" whenever we show mixed statuses (recent fallback or the home
  // embed) — an "Active Proposals" heading over Passed cards would be misleading.
  const displayTitle = (showingRecentProposals || !showFilters) ? "Recent Proposals" : title;

  return (
    <div className="w-full max-w-7xl mx-auto bg-card p-6 rounded-lg shadow-sm">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">{displayTitle}</h2>
          <Link to="/proposals">
            <Button variant="outline" className="hidden sm:flex">
              View All Proposals
            </Button>
          </Link>
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
              <Select 
                value={statusFilter} 
                onValueChange={setStatusFilter}
                disabled={showingRecentProposals}
              >
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
        ) : displayProposals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayProposals.map((proposal) => (
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
            {showingRecentProposals ? (
              <>
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground">
                  No active proposals
                </h3>
                <p className="text-muted-foreground mt-2">
                  There are no active proposals at this time. 
                  <br />
                  <Link to="/create-proposal" className="text-primary hover:underline">
                    Create a new proposal
                  </Link>
                </p>
              </>
            ) : (
              <>
                <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground">
                  No proposals found
                </h3>
                <p className="text-muted-foreground mt-2">
                  {searchTerm || statusFilter !== 'active'
                    ? "Try adjusting your search or filters"
                    : "There are no proposals at this time"}
                </p>
              </>
            )}
          </div>
        )}

        <div className="flex justify-center sm:hidden mt-4">
          <Link to="/proposals">
            <Button variant="outline" className="w-full sm:w-auto">
              View All Proposals
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ActiveProposalsList;
