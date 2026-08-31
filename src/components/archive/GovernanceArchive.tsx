import React, { useEffect, useState } from "react";
import { Archive, ChevronDown, ChevronUp, Loader2, MinusCircle, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ARCHIVE_CHAIN_ID, formatVotes, shortHex, supportLabel } from "@/lib/archive";

/**
 * Read-only public record of governance on the original chain. No wallet, no votes,
 * no writes — and deliberately NO explorer links: the old explorer is retired, so a
 * link would 404. Hashes and addresses render as plain text instead.
 */

interface ArchivedProposal {
  id: string;
  title: string;
  description: string;
  summary?: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotes: number;
  state: string;
  category?: string;
  createdAt: string;
}

interface ArchivedVote {
  id: string;
  voter: string;
  support: number;
  votingPower: number;
  blockNumber: number;
  transactionHash: string;
  reason?: string;
}

interface VotesState {
  loading: boolean;
  loaded: boolean;
  error?: string;
  votes: ArchivedVote[];
}

const stateBadgeColor = (state: string): string => {
  switch (state) {
    case "Executed":
      return "bg-teal-100 text-teal-800";
    case "Succeeded":
      return "bg-green-100 text-green-800";
    case "Queued":
      return "bg-purple-100 text-purple-800";
    case "Defeated":
    case "Canceled":
    case "Expired":
      return "bg-red-100 text-red-800";
    default:
      return "bg-secondary text-foreground";
  }
};

const GovernanceArchive = () => {
  const [proposals, setProposals] = useState<ArchivedProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [votesByProposal, setVotesByProposal] = useState<Record<string, VotesState>>({});

  useEffect(() => {
    const fetchArchived = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("proposals")
          .select("*")
          .eq("chain_id", ARCHIVE_CHAIN_ID)
          .order("created_at", { ascending: false });

        if (error) {
          setError(error.message);
          return;
        }

        setProposals(
          (data || []).map((item) => {
            const votesFor = Number(item.votes_for) || 0;
            const votesAgainst = Number(item.votes_against) || 0;
            const votesAbstain = Number(item.votes_abstain) || 0;
            return {
              id: item.proposal_id,
              title: item.title,
              description: item.description,
              summary: item.summary,
              votesFor,
              votesAgainst,
              votesAbstain,
              totalVotes: votesFor + votesAgainst + votesAbstain,
              state: item.state || "Unknown",
              category: item.category,
              createdAt: item.created_at,
            };
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchArchived();
  }, []);

  const toggleVotes = async (proposalId: string) => {
    const isOpen = !!expanded[proposalId];
    setExpanded((prev) => ({ ...prev, [proposalId]: !isOpen }));
    if (isOpen || votesByProposal[proposalId]?.loaded || votesByProposal[proposalId]?.loading) {
      return;
    }

    setVotesByProposal((prev) => ({
      ...prev,
      [proposalId]: { loading: true, loaded: false, votes: [] },
    }));
    try {
      const { data, error } = await supabase
        .from("votes_history")
        .select("*")
        .eq("proposal_id", proposalId)
        .eq("network_id", ARCHIVE_CHAIN_ID)
        .order("block_number", { ascending: true });

      if (error) {
        setVotesByProposal((prev) => ({
          ...prev,
          [proposalId]: { loading: false, loaded: false, error: error.message, votes: [] },
        }));
        return;
      }

      setVotesByProposal((prev) => ({
        ...prev,
        [proposalId]: {
          loading: false,
          loaded: true,
          votes: (data || []).map((v) => ({
            id: v.id,
            voter: v.voter_address,
            support: Number(v.support),
            votingPower: Number(v.voting_power) || 0,
            blockNumber: Number(v.block_number) || 0,
            transactionHash: v.transaction_hash,
            reason: v.reason || undefined,
          })),
        },
      }));
    } catch (err) {
      setVotesByProposal((prev) => ({
        ...prev,
        [proposalId]: {
          loading: false,
          loaded: false,
          error: err instanceof Error ? err.message : "An unknown error occurred",
          votes: [],
        },
      }));
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Archive className="h-7 w-7 text-primary" />
          Governance Archive
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Read-only record of governance on the original KalyChain (KLC), preserved after
          the KMT relaunch. These proposals concluded on the previous chain; nothing here
          can be voted on or changed. Transaction hashes are shown as plain text — the
          previous chain's explorer has been retired.
        </p>
      </div>

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
          <p className="text-muted-foreground">Loading archived proposals...</p>
        </div>
      ) : proposals.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Archive className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">No archived proposals</h3>
          <p className="text-muted-foreground mt-2">
            The archive is empty — no proposals were recorded on the previous chain.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {proposals.map((proposal) => {
            const votesState = votesByProposal[proposal.id];
            const isOpen = !!expanded[proposal.id];
            const forPct =
              proposal.totalVotes > 0 ? Math.round((proposal.votesFor / proposal.totalVotes) * 100) : 0;
            const againstPct =
              proposal.totalVotes > 0 ? Math.round((proposal.votesAgainst / proposal.totalVotes) * 100) : 0;
            const abstainPct =
              proposal.totalVotes > 0 ? Math.round((proposal.votesAbstain / proposal.totalVotes) * 100) : 0;

            return (
              <Card key={proposal.id} className="w-full overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-xl font-bold">{proposal.title}</CardTitle>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${stateBadgeColor(proposal.state)}`}
                    >
                      {proposal.state}
                    </span>
                  </div>
                  <CardDescription className="mt-2 line-clamp-3">
                    {proposal.summary || proposal.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span>Created {new Date(proposal.createdAt).toLocaleDateString()}</span>
                    {proposal.category && <span>Category: {proposal.category}</span>}
                    <span className="font-mono" title={proposal.id}>
                      ID {shortHex(proposal.id, 8, 6)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                      <span>
                        {formatVotes(proposal.votesFor)} ({forPct}%) For
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsDown className="h-4 w-4 text-red-600" />
                      <span>
                        {formatVotes(proposal.votesAgainst)} ({againstPct}%) Against
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MinusCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {formatVotes(proposal.votesAbstain)} ({abstainPct}%) Abstain
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{formatVotes(proposal.totalVotes)} votes recorded</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVotes(proposal.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      )}
                      {isOpen ? "Hide votes" : "Show votes"}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="mt-4 border-t border-border/60 pt-4">
                      {votesState?.loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading votes...
                        </div>
                      ) : votesState?.error ? (
                        <p className="text-sm text-destructive">{votesState.error}</p>
                      ) : votesState?.votes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No individual votes were recorded for this proposal.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/60">
                                <th className="py-2 pr-4 font-medium">Voter</th>
                                <th className="py-2 pr-4 font-medium">Vote</th>
                                <th className="py-2 pr-4 font-medium">Power</th>
                                <th className="py-2 pr-4 font-medium">Block</th>
                                <th className="py-2 font-medium">Transaction</th>
                              </tr>
                            </thead>
                            <tbody>
                              {votesState?.votes.map((vote) => (
                                <tr key={vote.id} className="border-b border-border/30 last:border-0">
                                  <td className="py-2 pr-4 font-mono" title={vote.voter}>
                                    {shortHex(vote.voter)}
                                  </td>
                                  <td className="py-2 pr-4">{supportLabel(vote.support)}</td>
                                  <td className="py-2 pr-4">{formatVotes(vote.votingPower)}</td>
                                  <td className="py-2 pr-4">{vote.blockNumber || "—"}</td>
                                  <td className="py-2 font-mono text-xs" title={vote.transactionHash}>
                                    {shortHex(vote.transactionHash, 10, 8)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GovernanceArchive;
