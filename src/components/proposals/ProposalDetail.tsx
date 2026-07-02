import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Users,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import {
  useAccount,
  useReadContract,
  useChainId,
  useWriteContract,
  useTransaction,
  useBlockNumber,
  useWaitForTransactionReceipt,
  usePublicClient
} from 'wagmi';
import { WalletButton } from '@/components/WalletButton';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Discussion } from "./Discussion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type ProposalMetadata } from '@/lib/supabase';
import type { ProposalState } from '@/blockchain/types';
import { supabase, proposalQueries } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  getDaoSubgraphUrl,
  queryProposalDetail,
  queryHasVoted,
  deriveProposalState,
} from '@/lib/daoSubgraph';
import { getProposalLifecycleStep } from '@/lib/proposalLifecycle';
import { resolveDisplayVotes, isSpecialProposal, SPECIAL_PROPOSAL_IDS } from '@/lib/proposalVotes';
import { resolveVotingPower } from '@/lib/votingPower';
import { resolveProposalDataSource } from '@/lib/proposalDataSource';
import { useVoteHistory } from './useVoteHistory';
import { useDao } from '@/blockchain/hooks/useDao';
import { ethers } from 'ethers';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTransactionGasConfig } from '@/blockchain/config/transaction';
import { kalyChainMainnet, kalyChainTestnet } from '@/blockchain/config/chains';
import { CountdownTimer } from './CountdownTimer';
import { toast } from "@/components/ui/use-toast";
import { type Abi, type AbiEvent, decodeEventLog, parseGwei } from 'viem';
import { type Hash } from 'viem';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

// Define ProposalVotes interface with data field
interface ProposalVotes {
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  data?: {
    hasVoted: boolean;
    support: number;
    weight: bigint;
  };
}

// ProposalDetail component with simplified execution and queue mechanisms
// Uses a direct approach with single transactions and enhanced logging
// Removed retry mechanisms and multiple transaction attempts

interface DecodedProposalCreatedArgs {
  proposalId?: bigint;
  proposer?: `0x${string}`;
  targets?: readonly `0x${string}`[]; // Use readonly based on viem types
  values?: readonly bigint[];
  signatures?: readonly string[];
  calldatas?: readonly `0x${string}`[];
  voteStart?: bigint;
  voteEnd?: bigint;
  description?: string;
}

function hasProposalCreatedArgs(log: any): log is { args: DecodedProposalCreatedArgs } {
  return log && typeof log === 'object' && log.args && typeof log.args === 'object';
}

interface ProposalDetailProps {
  minProposalThreshold?: number;
}

const governorABI = [
  {
    name: 'proposalProposer',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'proposalSnapshot',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'proposalDeadline',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'proposalVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'againstVotes', type: 'uint256' },
      { name: 'forVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' }
    ]
  },
  {
    name: 'state',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'quorum',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'blockNumber', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'queue',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [],
  },
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [],
  },
  {
    name: 'timelock',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'proposalEta',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'hasVoted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'account', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'hashProposal',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'bytes32', name: 'descriptionHash' },
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;


const governanceTokenABI = [
  {
    name: 'delegates',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'delegate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'delegatee', type: 'address' }],
    outputs: []
  },
  {
    name: 'getVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getPastVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'blockNumber', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

const ProposalDetail = ({
  minProposalThreshold = 100000,
}: ProposalDetailProps) => {
  const { id } = useParams<{ id: string }>();
  // Safe proposalId for contract calls: BigInt(id) throws during render on a
  // malformed URL (e.g. /proposals/abc), white-screening the page. Parse once.
  const safeProposalId = useMemo<bigint | null>(() => {
    if (!id) return null;
    try { return BigInt(id); } catch { return null; }
  }, [id]);
  const [userVote, setUserVote] = useState<"for" | "against" | "abstain" | null>(null);
  const [voteDirection, setVoteDirection] = useState<"for" | "against" | "abstain" | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [voteReason, setVoteReason] = useState<string>("");
  const [proposalData, setProposalData] = useState<ProposalMetadata & { targets?: string[], values?: string[], calldatas?: string[], full_description?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelegated, setIsDelegated] = useState<boolean>(false);
  const [isDelegating, setIsDelegating] = useState<boolean>(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [isQueueing, setIsQueueing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [queueExecuteError, setQueueExecuteError] = useState<string | null>(null);
  const [queueExecuteHash, setQueueExecuteHash] = useState<Hash | undefined>();
  // Which action is in flight on the SHARED useWriteContract (vote/queue/execute).
  // Each receipt pipeline checks this so a queue tx can't trigger the vote handler
  // (that mislabeled queue txs as ABSTAIN votes) and vice-versa.
  const lastActionRef = useRef<'queue' | 'execute' | 'vote' | null>(null);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const [dbVoteTotals, setDbVoteTotals] = useState<{ votes_for: number, votes_against: number, votes_abstain: number } | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { contracts, vote, delegate } = useDao();

  // A proposal must be read from ITS OWN chain (stored in Supabase chain_id), NOT the
  // wallet's chain — otherwise viewing a mainnet proposal while connected to testnet
  // (or vice-versa) reads the wrong Governor and shows empty/zero data. Until the
  // Supabase row loads we fall back to the wallet chain. Defined before the receipt
  // watcher below so it can be pinned to the proposal's chain.
  const proposalChainId =
    ((proposalData as { chain_id?: number } | null)?.chain_id) ?? chainId;
  const isWrongNetwork = !!proposalData && chainId !== proposalChainId;
  const currentChain = proposalChainId === 3889 ? kalyChainTestnet : kalyChainMainnet;

  const { data: txHash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();
  // Pin the receipt watcher to the PROPOSAL's chain (same as every read/write here), so
  // the vote confirmation fires even if the bridge's active chain briefly lags.
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash, chainId: proposalChainId });
  const publicClient = usePublicClient();

  // Get the correct contract addresses based on the PROPOSAL's network
  const governorAddress = proposalChainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNOR_CONTRACT
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNOR_CONTRACT;

  const governanceTokenAddress = proposalChainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN;

  // Current block on the PROPOSAL's chain (so countdowns/period checks use the right
  // chain, not the wallet's).
  const { data: currentBlock } = useBlockNumber({
    chainId: proposalChainId,
    watch: true,
  });

  // ── DAO subgraph: source of truth on mainnet ────────────────────────────────
  // The subgraph gives proposer/blocks/votes/quorum/status/eta in ONE query, so we
  // stop hitting the RPC per-proposal. Testnet has no subgraph, so there the
  // on-chain reads below stay enabled as a fallback. `state` is DERIVED from the
  // subgraph (deriveProposalState) for display; the on-chain `state()` read is kept
  // lazy (enabled:false on mainnet) and only refetched on demand as the queue/execute
  // gate, where an authoritative, lag-free value matters.
  const daoSubgraphUrl = getDaoSubgraphUrl(proposalChainId);
  const hasDaoSubgraph = !!daoSubgraphUrl;

  const { data: sgData, refetch: refetchSubgraph } = useQuery({
    queryKey: ['daoProposal', proposalChainId, id, address],
    enabled: hasDaoSubgraph && !!safeProposalId,
    refetchInterval: 12_000,
    queryFn: async () => {
      const [detail, voted] = await Promise.all([
        queryProposalDetail(daoSubgraphUrl as string, id as string),
        address ? queryHasVoted(daoSubgraphUrl as string, id as string, address) : Promise.resolve(false),
      ]);
      return { detail, voted };
    },
  });
  const sgDetail = sgData?.detail ?? null;

  // Where do votes/quorum/state/blocks/eta come from? Subgraph when it answers, else
  // on-chain. `subgraphUnavailable` is true when the subgraph is configured but gave
  // us nothing (down / GraphQL error / not indexed) so the on-chain reads below take
  // over instead of leaving the page blank (audit H1).
  const { useOnChainReads, subgraphUnavailable } = resolveProposalDataSource({
    hasDaoSubgraph,
    subgraphResponded: sgData !== undefined,
    hasSubgraphDetail: !!sgDetail,
  });

  const { data: deadlineOnChain } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalDeadline',
    args: [safeProposalId ?? 0n],
    chainId: proposalChainId,
    account: address,
    query: { enabled: useOnChainReads },
  });

  const { data: proposerOnChain } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalProposer',
    args: [safeProposalId ?? 0n],
    chainId: proposalChainId,
    account: address,
    query: { enabled: useOnChainReads },
  });

  const { data: snapshotOnChain } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalSnapshot',
    args: [safeProposalId ?? 0n],
    chainId: proposalChainId,
    account: address,
    query: { enabled: useOnChainReads },
  });

  const { data: rawVotesOnChain, refetch: refetchVotesOnChain } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'proposalVotes',
    args: [safeProposalId ?? 0n],
    chainId: proposalChainId,
    account: address,
    query: { enabled: useOnChainReads },
  });

  // On-chain state(). On mainnet this NEVER auto-fires (enabled:false) — display state
  // is derived from the subgraph — but refetchStateOnChain() still works on demand and
  // is used as the authoritative queue/execute gate. On testnet it drives display.
  const { data: stateOnChain, refetch: refetchStateOnChain } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'state',
    args: [safeProposalId ?? 0n],
    chainId: proposalChainId,
    account: address,
    query: { enabled: useOnChainReads },
  });

  // Read proposalEta (timestamp when it can be executed) — testnet fallback only.
  const { data: proposalEtaOnChain, refetch: refetchEtaOnChain } = useReadContract({
     address: governorAddress as `0x${string}`,
     abi: governorABI,
     functionName: 'proposalEta',
     args: safeProposalId != null ? [safeProposalId] : undefined,
     chainId: proposalChainId,
     account: address,
     query: {
       enabled: useOnChainReads && !!id && Number(stateOnChain) === 5,
     }
  });

  // On-chain quorum at the snapshot block — testnet fallback only.
  const { data: quorumRawOnChain } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'quorum',
    args: snapshotOnChain ? [BigInt(snapshotOnChain)] : undefined,
    chainId: proposalChainId,
    account: address,
    query: { enabled: useOnChainReads && !!snapshotOnChain },
  });

  // On-chain "has this wallet already voted?" — testnet fallback only.
  const { data: hasVotedOnChain, refetch: refetchHasVotedOnChain } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorABI,
    functionName: 'hasVoted',
    args: safeProposalId != null && address ? [safeProposalId, address] : undefined,
    chainId: proposalChainId,
    account: address,
    query: { enabled: useOnChainReads && !!id && !!address },
  });

  // ── Merged values: subgraph when it answers, on-chain otherwise ─────────────
  // Downstream code uses these names unchanged (deadline/snapshot/rawVotes/state/…).
  // `useOnChainReads` is true on testnet AND when the mainnet subgraph is unavailable,
  // so a subgraph outage transparently falls back to the chain instead of blanking.
  const deadline = useOnChainReads ? deadlineOnChain : sgDetail?.voteEnd;
  const proposer = useOnChainReads ? proposerOnChain : sgDetail?.proposer;
  const snapshot = useOnChainReads ? snapshotOnChain : sgDetail?.voteStart;
  // Memoized: this array is a dependency of the data-fetch effect below, so a fresh
  // reference each render would loop it forever (isLoading never settles).
  const rawVotes = useMemo(
    () =>
      (useOnChainReads
        ? rawVotesOnChain
        : sgDetail
          ? [sgDetail.againstVotes, sgDetail.forVotes, sgDetail.abstainVotes]
          : undefined) as readonly [bigint, bigint, bigint] | undefined,
    [useOnChainReads, sgDetail, rawVotesOnChain],
  );
  const quorumRaw = useOnChainReads ? quorumRawOnChain : sgDetail?.quorumVotes;
  const proposalEta = useOnChainReads ? proposalEtaOnChain : (sgDetail?.eta ?? undefined);
  const onChainHasVoted = useOnChainReads ? hasVotedOnChain : !!sgData?.voted;
  // Live state: on-chain state() in fallback/testnet; derived from subgraph + block otherwise.
  const state = useOnChainReads
    ? stateOnChain
    : (sgDetail && currentBlock ? deriveProposalState(sgDetail, BigInt(currentBlock)) : undefined);

  // ── Voting power the Governor will ACTUALLY count ───────────────────────────
  // castVote weighs a vote with getPastVotes(voter, snapshot) — delegated power at
  // the snapshot block, NOT the live balance. Gating/displaying the live balance
  // let wallets that wrapped/delegated after the snapshot cast 0-weight votes while
  // the UI showed millions (July 2026 mainnet incident). getPastVotes reverts until
  // the snapshot block is mined, so it's only enabled once we're past it.
  const snapshotMined =
    snapshot !== undefined && snapshot !== null && !!currentBlock &&
    BigInt(currentBlock) > BigInt(snapshot as bigint);

  const { data: snapshotPowerWei } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI,
    functionName: 'getPastVotes',
    args: address && snapshot !== undefined && snapshot !== null
      ? [address, BigInt(snapshot as bigint)]
      : undefined,
    chainId: proposalChainId,
    query: { enabled: !!address && snapshotMined },
  });

  // Live delegated power — used as the estimate while a proposal is Pending and to
  // detect the "you got gKLC after the snapshot" case for the explainer message.
  const { data: currentPowerWei } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    chainId: proposalChainId,
    query: { enabled: !!address },
  });

  // One refresh entry point: always poke the subgraph (so an outage can recover), and
  // refresh the on-chain reads whenever they're the active source (testnet or fallback).
  const refreshProposalData = useCallback(() => {
    if (hasDaoSubgraph) void refetchSubgraph();
    if (useOnChainReads) {
      void refetchStateOnChain?.();
      void refetchVotesOnChain?.();
      void refetchEtaOnChain?.();
      if (address) void refetchHasVotedOnChain?.();
    }
  }, [hasDaoSubgraph, useOnChainReads, refetchSubgraph, refetchStateOnChain, refetchVotesOnChain, refetchEtaOnChain, refetchHasVotedOnChain, address]);

  // Vote history from on-chain VoteCast truth (subgraph on mainnet, logs on testnet).
  // Never reads Supabase, so reverted/ghost votes can never appear here.
  const { votes: voteHistory, isLoading: isLoadingVotes } = useVoteHistory(
    id,
    governorAddress,
    proposalChainId,
    snapshot as bigint | undefined,
    deadline as bigint | undefined,
    refetchKey,
  );

  // Keep the lifecycle live: re-read on-chain state/votes/eta on every new block so
  // Active -> Succeeded -> Queued -> Executed transitions surface automatically,
  // without the user having to manually refresh. `currentBlock` advances via
  // useBlockNumber({ watch: true }); the refetch fns from wagmi are stable.
  useEffect(() => {
    if (!currentBlock || !id) return;
    // When the subgraph is the source it self-polls (refetchInterval) and state is
    // derived from the advancing block — so no per-block RPC. Re-read on-chain per block
    // only when on-chain reads are the active source (testnet, or a mainnet subgraph outage).
    if (!useOnChainReads) return;
    // Stop polling once the proposal is in a terminal state (Canceled/Defeated/
    // Executed) — those never change, so per-block refetching is pure waste.
    const terminal = [2, 3, 7].includes(Number(state));
    if (terminal) return;
    refetchStateOnChain?.();
    refetchVotesOnChain?.();
    if (address) refetchHasVotedOnChain?.();
    if (Number(state) === 5) refetchEtaOnChain?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock]);

  // Increment the view count once per page view (keyed on the proposal id) — NOT on
  // every block/vote refresh, which used to inflate the counter.
  useEffect(() => {
    if (!id) return;
    supabase
      .rpc('increment_proposal_views', { proposal_id_param: id })
      .then(undefined, (e: unknown) => console.warn('Failed to increment views:', e));
  }, [id]);

  // Parse the votes data
  const votes: ProposalVotes = {
    forVotes: rawVotes ? rawVotes[1] : 0n,
    againstVotes: rawVotes ? rawVotes[0] : 0n,
    abstainVotes: rawVotes ? rawVotes[2] : 0n
  };

  // Convert bigint vote values to human-readable numbers (divide by 10^18)
  const formatTokenAmount = (amount: bigint): number => {
    return Number(amount) / 10**18;
  };

  // Vote totals come from on-chain proposalVotes() (the source of truth), so the
  // bars match the quorum box and stay correct on any network without a subgraph.
  // Special legacy proposals (#1/#2) keep their injected Supabase values.
  const displayVotes = resolveDisplayVotes({
    isSpecial: isSpecialProposal(id),
    onChain: {
      forVotes: formatTokenAmount(votes.forVotes),
      againstVotes: formatTokenAmount(votes.againstVotes),
      abstainVotes: formatTokenAmount(votes.abstainVotes),
    },
    supabase: {
      forVotes: dbVoteTotals?.votes_for || 0,
      againstVotes: dbVoteTotals?.votes_against || 0,
      abstainVotes: dbVoteTotals?.votes_abstain || 0,
    },
  });
  const formattedForVotes = displayVotes.forVotes;
  const formattedAgainstVotes = displayVotes.againstVotes;
  const formattedAbstainVotes = displayVotes.abstainVotes;
  const totalVotes = displayVotes.totalVotes;

  // Calculate voting percentages
  const forPercentage = totalVotes > 0 ? (formattedForVotes / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (formattedAgainstVotes / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (formattedAbstainVotes / totalVotes) * 100 : 0;

  // On-chain quorum status. OpenZeppelin's GovernorCountingSimple counts
  // For + Abstain toward quorum (Against does not count).
  const quorumRequired = quorumRaw !== undefined ? formatTokenAmount(quorumRaw as bigint) : null;
  const quorumCurrent = formatTokenAmount(votes.forVotes + votes.abstainVotes);
  const quorumMet = quorumRequired !== null && quorumCurrent >= quorumRequired;
  const quorumProgress =
    quorumRequired && quorumRequired > 0 ? Math.min(100, (quorumCurrent / quorumRequired) * 100) : 0;

  // Check delegation status
  const { data: currentDelegate, refetch: refetchDelegate } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI,
    functionName: 'delegates',
    args: [address || '0x0000000000000000000000000000000000000000'],
    chainId: proposalChainId,
    account: address
  });

  // Update delegation status when currentDelegate changes
  useEffect(() => {
    if (currentDelegate && address) {
      setIsDelegated(currentDelegate.toLowerCase() === address.toLowerCase());
    }
  }, [currentDelegate, address]);

  // Handle delegation
  const handleDelegate = async () => {
    if (!address || !chainId || !writeContract) return;

    setIsDelegating(true);
    setDelegateError(null);

    try {
      await delegate(address as `0x${string}`, writeContract);
      // Don't optimistically assume success — re-read the on-chain delegate so
      // isDelegated reflects reality (a rejected/failed delegation stays false).
      setTimeout(() => refetchDelegate?.(), 3000);
    } catch (err) {
      console.error('Failed to delegate:', err);
      setDelegateError(err instanceof Error ? err.message : 'Failed to delegate voting power');
    } finally {
      setIsDelegating(false);
    }
  };

  // Fetch both on-chain and off-chain data
  useEffect(() => {
    const fetchProposalData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        console.log('Fetching proposal data for ID:', id);

        // Try to check if we have the last proposal ID stored in localStorage
        const lastProposalIdHex = localStorage.getItem('lastProposalIdHex');
        const lastProposalIdDecimal = localStorage.getItem('lastProposalIdDecimal');
        console.log('Last proposal IDs from localStorage:', {
          hex: lastProposalIdHex,
          decimal: lastProposalIdDecimal
        });

        // Try to normalize the ID format - it could be in decimal or hex format
        let proposalIdForSupabase = id;

        // If id is a hex string (starts with 0x), convert to decimal
        if (id.startsWith('0x')) {
          proposalIdForSupabase = BigInt(id).toString();
          console.log('Converted hex ID to decimal:', proposalIdForSupabase);
        }

        // List of IDs to try in order of likelihood
        const idsToTry = [
          proposalIdForSupabase,
          lastProposalIdDecimal,
          lastProposalIdHex
        ].filter(Boolean); // Remove nulls/undefined

        if (id.startsWith('0x')) {
          // If original ID is hex, add the decimal version
          idsToTry.push(BigInt(id).toString());
        } else if (!id.startsWith('0x')) {
          // If original ID is decimal, add the hex version
          idsToTry.push('0x' + BigInt(id).toString(16));
        }

        console.log('Will try these IDs in sequence:', idsToTry);

        // Try various formats of the proposal ID to find the right one
        const tryFetchProposal = async (proposalId: string) => {
          if (!proposalId) return null;

          // Query by proposal_id ALONE — proposal ids are globally unique hashes, so
          // a proposal must be found regardless of which network the wallet is on
          // (it carries its own chain_id, used for the on-chain reads below).
          const { data, error } = await supabase
            .from('proposals')
            .select('*, targets, values, calldatas, full_description')
            .eq('proposal_id', proposalId)
            .single();

          if (error) {
            console.log('Error fetching with ID', proposalId, ':', error.message);
            return null;
          }
          return data;
        };

        // Try each ID format until we find a match
        let proposal = null;
        for (const idToTry of idsToTry) {
          proposal = await tryFetchProposal(idToTry);
          if (proposal) {
            console.log('Successfully found proposal with ID:', idToTry);
            break;
          }
        }

        // If still not found, try removing leading zeros from decimal format
        if (!proposal && proposalIdForSupabase.startsWith('0')) {
          const noLeadingZeros = proposalIdForSupabase.replace(/^0+/, '');
          console.log('Trying without leading zeros:', noLeadingZeros);
          proposal = await tryFetchProposal(noLeadingZeros);
        }

        // (Removed the loose "broader search" partial-match fallback — it loaded a
        // DIFFERENT proposal when the exact id wasn't found on the wallet's chain,
        // showing the wrong proposal's metadata. If the id isn't found, it's not
        // found.)

        if (!proposal) {
          throw new Error(`Proposal not found with ID ${id}`);
        }

        setProposalData(proposal);

        // (View count is incremented once per page view in a separate effect, not
        // here — this effect re-runs on every block/vote change, which inflated it.)

        // Update on-chain data in Supabase if needed
        if (proposal && rawVotes && snapshot && deadline && state !== undefined) {
          // Format votes for database (convert from wei)
          const dbVotesFor = formatTokenAmount(votes.forVotes);
          const dbVotesAgainst = formatTokenAmount(votes.againstVotes);
          const dbVotesAbstain = formatTokenAmount(votes.abstainVotes);

          console.log('Updating proposal with on-chain data:', {
            votes_for: dbVotesFor,
            votes_against: dbVotesAgainst,
            votes_abstain: dbVotesAbstain,
            state: Number(state),
            snapshot: Number(snapshot),
            deadline: Number(deadline)
          });

          // Compare with existing data before updating
          const needsUpdate =
            Math.abs(proposal.votes_for - dbVotesFor) > 0.001 ||
            Math.abs(proposal.votes_against - dbVotesAgainst) > 0.001 ||
            Math.abs(proposal.votes_abstain - dbVotesAbstain) > 0.001 ||
            // Compare label-to-label; the old code compared a label ("Active") to a
            // numeric string ("1"), so this was always true and wrote every run.
            proposal.state !== getProposalState(Number(state)) ||
            proposal.snapshot_timestamp !== Number(snapshot) ||
            proposal.deadline_timestamp !== Number(deadline);

          if (needsUpdate) {
            console.log('Updating proposal in database with latest blockchain data');

            // Special case for the specific proposal IDs
            if (specialProposalIds.includes(proposal.proposal_id)) {
              console.log('Special case: Skipping state update for proposal ID:', proposal.proposal_id);
              // Update everything except the state
              await supabase
                .from('proposals')
                .update({
                  votes_for: dbVotesFor,
                  votes_against: dbVotesAgainst,
                  votes_abstain: dbVotesAbstain,
                  snapshot_timestamp: Number(snapshot),
                  deadline_timestamp: Number(deadline),
                  updated_at: new Date().toISOString(),
                  // Explicitly set state to 'Succeeded' for this proposal
                  state: 'Succeeded'
                })
                .eq('proposal_id', proposal.proposal_id);
            } else {
              // Normal update for all other proposals
              await supabase
                .from('proposals')
                .update({
                  votes_for: dbVotesFor,
                  votes_against: dbVotesAgainst,
                  votes_abstain: dbVotesAbstain,
                  state: getProposalState(Number(state)),
                  snapshot_timestamp: Number(snapshot),
                  deadline_timestamp: Number(deadline),
                  updated_at: new Date().toISOString(),
                })
                .eq('proposal_id', proposal.proposal_id);
            }
          } else {
            console.log('No updates needed - database matches blockchain data');
          }
        } else {
          console.log('Skipping database update - missing on-chain data', {
            hasVotes: !!rawVotes,
            proposalLoaded: !!proposal,
            hasSnapshot: !!snapshot,
            hasDeadline: !!deadline,
            hasState: state !== undefined
          });
        }
      } catch (err) {
        console.error('Error fetching proposal data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load proposal data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposalData();
  }, [id, rawVotes, state, snapshot, deadline, chainId]);

  // Special proposal IDs that need to show as Succeeded (shared single source).
  const specialProposalIds = SPECIAL_PROPOSAL_IDS;

  // Update getProposalState to handle numeric states
  const getProposalState = (state: number | string): string => {
    // Special case for the specific proposal IDs that need to show as Succeeded
    if (specialProposalIds.includes(id || '')) {
      console.log('Special case: Overriding proposal state to Succeeded for ID:', id);
      return 'Succeeded';
    }

    const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
    if (typeof state === 'string') {
      return state;
    }
    return states[state] || 'Unknown';
  };

  // Power the Governor will count for THIS proposal (snapshot-based), plus the flag
  // for "wallet has gKLC now but had none at the snapshot" so the UI can explain
  // why voting is unavailable instead of showing a number the contract won't honor.
  const { effectivePowerWei, acquiredAfterSnapshot } = resolveVotingPower({
    snapshotPowerWei: snapshotPowerWei as bigint | undefined,
    currentPowerWei: currentPowerWei as bigint | undefined,
    snapshotMined,
  });
  const userVotingPower = Number(effectivePowerWei) / 1e18;

  // Rename local function to avoid import conflict
  const formatVoteNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  // Format date
  const formatDate = (dateString: string | number | bigint) => {
    if (typeof dateString === 'string') {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // If it's a block number, calculate estimated date.
    // Average block time is 2 seconds for KalyChain. While currentBlock is still
    // loading, don't compute a wildly-wrong date off block 0.
    const AVERAGE_BLOCK_TIME = 2; // seconds
    if (!currentBlock) return 'Calculating…';
    const blockDifference = Number(dateString) - Number(currentBlock);
    const secondsUntil = blockDifference * AVERAGE_BLOCK_TIME;
    const estimatedDate = new Date(Date.now() + (secondsUntil * 1000));
    return estimatedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Handle vote
  const handleVote = async (direction: "for" | "against" | "abstain") => {
    setUserVote(direction);
    setVoteDirection(direction);
    console.log(`handleVote called with direction: ${direction}`);
    console.log(`Current isDelegated state: ${isDelegated}`);
    if (!isDelegated) {
      console.log('Vote stopped: User is not delegated.');
      setDelegateError('You need to delegate your voting power first');
      return;
    }

    console.log('User is delegated. Showing vote dialog.');
    setShowVoteDialog(true);
  };

  const confirmVote = async () => {
    console.log('confirmVote started.');
    if (!writeContract || !id || !address) {
      console.log('confirmVote stopped: Missing writeContract, id, or address');
      return;
    }

    lastActionRef.current = 'vote';
    setIsSubmitting(true);
    setVoteStatus('Preparing transaction...');
    try {
      // Convert direction to support value (0=against, 1=for, 2=abstain)
      const supportValue = voteDirection === 'for' ? 1 : voteDirection === 'against' ? 0 : 2;

      console.log(`Calling vote function with: proposalId=${id}, supportValue=${supportValue}, reason=${voteReason.trim() || 'Voted via KalyDAO dApp'}`);

      // Call vote without await - the transaction will be tracked via useWriteContract and useWaitForTransactionReceipt
      vote(
        BigInt(id),
        supportValue,
        voteReason.trim() || 'Voted via KalyDAO dApp',
        writeContract
      );
      console.log('vote function call initiated.');

      // Do NOT set userVote here yet - wait for confirmation
      setShowVoteDialog(false);
    } catch (err) {
      console.error('Failed to vote:', err);
      // Route to a toast/voteStatus, NOT the page-level `error` (which unmounts the
      // whole proposal page).
      lastActionRef.current = null;
      setIsSubmitting(false);
      setVoteStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast({
        title: 'Vote failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    // NOTE: isSubmitting stays true through the pending tx; it is cleared on a
    // confirmed receipt (vote handler) or on writeError. This keeps the vote
    // controls hidden during the pending window (no double-fire).
  };

  // Status badge color
  const getStatusColor = () => {
    // Special case for our specific proposal IDs
    if (specialProposalIds.includes(id || '')) {
      console.log('Special case: Using green color for Succeeded status for ID:', id);
      return "bg-green-100 text-green-800"; // Green color for Succeeded
    }

    // For string state values
    if (typeof state === 'string') {
      switch (state) {
        case 'Pending': return "bg-yellow-100 text-yellow-800";
        case 'Active': return "bg-green-100 text-green-800";
        case 'Canceled': return "bg-red-100 text-red-800";
        case 'Defeated': return "bg-red-100 text-red-800";
        case 'Succeeded': return "bg-green-100 text-green-800";
        case 'Queued': return "bg-blue-100 text-blue-800";
        case 'Expired': return "bg-secondary text-foreground";
        case 'Executed': return "bg-purple-100 text-purple-800";
        default: return "bg-secondary text-foreground";
      }
    }

    // For numeric state values
    switch (Number(state)) {
      case 0: return "bg-yellow-100 text-yellow-800"; // Pending
      case 1: return "bg-green-100 text-green-800";   // Active
      case 2: return "bg-red-100 text-red-800";       // Canceled
      case 3: return "bg-red-100 text-red-800";       // Defeated
      case 4: return "bg-green-100 text-green-800";   // Succeeded
      case 5: return "bg-blue-100 text-blue-800";     // Queued
      case 6: return "bg-secondary text-foreground";     // Expired
      case 7: return "bg-purple-100 text-purple-800"; // Executed
      default: return "bg-secondary text-foreground";
    }
  };

  // Check if voting is allowed
  const canVote = () => {
    if (!isConnected) return false;
    // Wallet must be on the proposal's network to actually submit a vote.
    if (isWrongNetwork) return false;
    // On-chain truth: if this wallet already voted, never show the controls again
    // (survives reloads and the block-watch refetch). Falls back to the session
    // `userVote` for the same tab before the on-chain read refreshes.
    if (onChainHasVoted) return false;
    if (userVote) return false;
    // A vote tx is in flight — keep controls hidden so the user can't double-fire.
    if (isSubmitting) return false;
    if (userVotingPower <= 0) return false;

    // Voting period check against the real chain head (the old code mistakenly used
    // `snapshot` as the current block, making this always true).
    const head = currentBlock ? Number(currentBlock) : 0;
    const start = snapshot ? Number(snapshot) : 0;
    const proposalDeadline = deadline ? Number(deadline) : 0;
    const isVotingPeriod = head >= start && head <= proposalDeadline;

    // Convert state to number if it's a string
    const numericState = typeof state === 'string' ?
      ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed']
        .indexOf(state) : Number(state);

    // Only allow voting if state is Active (1)
    // Note: Pending (0) means we're in the delay period and voting hasn't started yet
    return numericState === 1 && isVotingPeriod;
  };

  // Keep proposalCreatedEventAbi definition
  const proposalCreatedEventAbi: AbiEvent = {
      anonymous: false,
      inputs: [
        { indexed: false, internalType: "uint256", name: "proposalId", type: "uint256" },
        { indexed: false, internalType: "address", name: "proposer", type: "address" },
        { indexed: false, internalType: "address[]", name: "targets", type: "address[]" },
        { indexed: false, internalType: "uint256[]", name: "values", type: "uint256[]" },
        { indexed: false, internalType: "string[]", name: "signatures", type: "string[]" },
        { indexed: false, internalType: "bytes[]", name: "calldatas", type: "bytes[]" },
        { indexed: false, internalType: "uint256", name: "voteStart", type: "uint256" },
        { indexed: false, internalType: "uint256", name: "voteEnd", type: "uint256" },
        { indexed: false, internalType: "string", name: "description", type: "string" }
      ],
      name: "ProposalCreated",
      type: "event"
    };

  // Track write errors
  useEffect(() => {
    if (writeError) {
      console.error('Error initiating vote transaction:', writeError);
      setVoteStatus(`Error initiating transaction: ${writeError.message || 'Unknown error'}`);
      setIsSubmitting(false);
    }
  }, [writeError]);

  // Hook to wait for queue/execute transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmationError } = useWaitForTransactionReceipt({
    hash: queueExecuteHash,
    chainId: proposalChainId,
  });

  // Effect to handle transaction confirmation and update database
  useEffect(() => {
    if (isConfirmed && queueExecuteHash) {
      console.log(`Transaction ${queueExecuteHash} confirmed!`);
      toast({ title: "Transaction Confirmed", description: "Blockchain updated successfully." });

      // Refresh so the lifecycle panel advances (Succeeded -> Queued -> Executed)
      // right away — the subgraph on mainnet, on-chain reads on testnet.
      refreshProposalData();

      // Use the action we actually fired (set in handleQueue/handleExecute), NOT the
      // current `state` — the block-watcher may already have advanced it, which used
      // to make a queue write "Executed" to the DB.
      let newStateText: string | null = null;
      if (lastActionRef.current === 'queue') {
          newStateText = getProposalState(5); // Queued
      } else if (lastActionRef.current === 'execute') {
          newStateText = getProposalState(7); // Executed
      }
      lastActionRef.current = null;

      if (newStateText && proposalData) {
        console.log(`Updating database state to ${newStateText} after confirmation.`);
        supabase
          .from('proposals')
          .update({ state: newStateText, updated_at: new Date().toISOString() })
          .eq('proposal_id', proposalData.proposal_id) // Use the correct ID from loaded data
          .then(({ error: dbError }) => {
            if (dbError) {
              console.error('Failed to update database state after confirmation:', dbError);
              toast({ title: "DB Sync Error", description: "Transaction confirmed, but database update failed.", variant: "destructive" });
            } else {
              console.log("Database state updated successfully after confirmation.");
              // Optionally force re-fetch proposal data to update UI state
              // fetchProposalData();
            }
          });
      } else {
          console.warn("Could not determine new state or proposalData missing, skipping DB update after confirmation.");
      }

      // Reset button states and hash
      setIsQueueing(false);
      setIsExecuting(false);
      setQueueExecuteHash(undefined);

    } else if (confirmationError && queueExecuteHash) {
      console.error(`Transaction ${queueExecuteHash} failed to confirm:`, confirmationError);
      toast({ title: "Transaction Failed", description: confirmationError.message, variant: "destructive" });
      setQueueExecuteError(`Transaction Failed: ${confirmationError.message}`);
      // Reset button states and hash
      setIsQueueing(false);
      setIsExecuting(false);
      setQueueExecuteHash(undefined);
    }
  }, [isConfirmed, confirmationError, queueExecuteHash, state, proposalData]); // Add dependencies

  // Route a submitted tx into the queue/execute confirm pipeline ONLY when the
  // in-flight action is queue/execute. Votes use the separate vote handler, so we
  // must not pull a vote tx in here (that showed queue/execute toasts for votes).
  useEffect(() => {
    if (txHash && (lastActionRef.current === 'queue' || lastActionRef.current === 'execute')) {
      console.log("Queue/execute tx submitted, hash:", txHash);
      setQueueExecuteHash(txHash);
      toast({
        title: 'Transaction submitted',
        description: 'Waiting for on-chain confirmation…',
      });
      // isWritePending becomes false; isConfirming takes over the button state.
      if (isQueueing) setIsQueueing(false);
      if (isExecuting) setIsExecuting(false);
    }
  }, [txHash]); // Dependency on txHash

  // Regular functions that we're keeping
  const handleQueue = async () => {
    if (!writeContract || !id || !governorAddress || !address) {
      console.error('Missing required data for queue', { writeContract, id, governorAddress });
      return;
    }

    lastActionRef.current = 'queue';
    setIsQueueing(true);
    setQueueExecuteError(null);

    try {
      console.log('Queueing proposal', id);

      // Get parameters from proposalData and convert to the correct types
      const targets = (proposalData?.targets || []).map(t => t as `0x${string}`);
      const values = (proposalData?.values || []).map(v => BigInt(v));
      const calldatas = (proposalData?.calldatas || []).map(c => c as `0x${string}`);

      // Preflight: a proposal with missing/mismatched execution data would revert
      // with a cryptic "unknown proposal id". Fail clearly instead.
      if (targets.length === 0 || targets.length !== values.length || targets.length !== calldatas.length) {
        lastActionRef.current = null;
        setIsQueueing(false);
        setQueueExecuteError('This proposal is missing its on-chain execution data and cannot be queued.');
        toast({
          title: 'Cannot queue',
          description: 'This proposal is missing its on-chain execution data.',
          variant: 'destructive',
        });
        return;
      }

      // Get the ORIGINAL full description text (not the hash)
      const descriptionText = proposalData?.full_description ||
        `${proposalData?.title}\n\n${proposalData?.description}`;

      // Calculate the keccak256 hash of the description using ethers
      // This is what the contract uses internally for hashProposal
      const descriptionHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(descriptionText)
      ) as `0x${string}`;

      console.log('Queue parameters:', {
        targets,
        values,
        calldatas,
        descriptionHash,
        descriptionText: descriptionText.substring(0, 100) + '...' // Log part of the text
      });

      // Get transaction gas config from the shared utility
      const gasConfig = getTransactionGasConfig();
      console.log('Using gas config:', gasConfig);

      // Use the standard wagmi pattern that works in other components
      writeContract({
        address: governorAddress as `0x${string}`,
        abi: governorABI,
        functionName: 'queue',
        args: [targets, values, calldatas, descriptionHash],
        chain: currentChain,
        account: address,
        ...gasConfig
      });

      console.log('Queue transaction initiated');

      toast({
        title: 'Proposal Queued',
        description: 'The transaction has been submitted.',
      });

      // Note: txHash will be set by the useEffect that watches for txHash changes
      setRefetchKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error queueing proposal:', error);
      setQueueExecuteError(error?.message || 'An error occurred while queueing the proposal');

      toast({
        title: 'Queue Failed',
        description: error?.message || 'An error occurred while queueing the proposal',
        variant: 'destructive',
      });
      setIsQueueing(false);
    }
  };

  const handleExecute = async () => {
    if (!writeContract || !id || !governorAddress || !address) {
      console.error('Missing required data for execution', { writeContract, id, governorAddress });
      return;
    }

    lastActionRef.current = 'execute';
    setIsExecuting(true);
    setQueueExecuteError(null);

    try {
      // Authoritative on-chain state() read, on demand — the queue/execute gate.
      // This is the one RPC read we deliberately keep (even on mainnet, where display
      // is subgraph-derived) because acting on a lagging state would revert the tx.
      const refreshed = await refetchStateOnChain?.();
      const freshState = refreshed?.data ?? state;

      // Must be Queued (5) to execute.
      if (freshState !== undefined && Number(freshState) !== 5) {
        const stateMessage = `Current state: ${getProposalState(Number(freshState))} (${freshState})`;
        console.error(`Proposal not in Queued state. ${stateMessage}`);
        throw new Error(`Invalid proposal state: ${stateMessage}. Must be Queued (5).`);
      }

      // Check timelock delay using the data from the hook
      if (proposalEta && Date.now() / 1000 < Number(proposalEta)) {
        throw new Error('Timelock delay has not passed yet');
      }

      console.log('Executing proposal', id);

      // Get parameters from proposalData and convert to the correct types
      const targets = (proposalData?.targets || []).map(t => t as `0x${string}`);
      const values = (proposalData?.values || []).map(v => BigInt(v));
      const calldatas = (proposalData?.calldatas || []).map(c => c as `0x${string}`);

      // Preflight (same as queue): missing/mismatched execution data → clear error.
      if (targets.length === 0 || targets.length !== values.length || targets.length !== calldatas.length) {
        lastActionRef.current = null;
        setIsExecuting(false);
        setQueueExecuteError('This proposal is missing its on-chain execution data and cannot be executed.');
        toast({
          title: 'Cannot execute',
          description: 'This proposal is missing its on-chain execution data.',
          variant: 'destructive',
        });
        return;
      }

      // Get the ORIGINAL full description text (not the hash)
      const descriptionText = proposalData?.full_description ||
        `${proposalData?.title}\n\n${proposalData?.description}`;

      // Calculate the keccak256 hash of the description using ethers
      // This is what the contract uses internally for hashProposal
      const descriptionHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(descriptionText)
      ) as `0x${string}`;

      console.log('Execute parameters:', {
        targets,
        values,
        calldatas,
        descriptionHash: descriptionHash,
        descriptionText: descriptionText.substring(0, 100) + '...' // Log part of the text
      });

      // Get transaction gas config from the shared utility
      const gasConfig = getTransactionGasConfig();
      console.log('Using gas config:', gasConfig);

      // Use the standard wagmi pattern that works in other components
      writeContract({
        address: governorAddress as `0x${string}`,
        abi: governorABI,
        functionName: 'execute',
        args: [targets, values, calldatas, descriptionHash],
        chain: currentChain,
        account: address,
        ...gasConfig,
        // execute() RUNS the proposal's on-chain actions (transfers, param changes,
        // possibly several), so the default 300k is far too low and an action proposal
        // would revert out-of-gas. Give generous headroom (unused gas is refunded);
        // matches kaly-vault's heavy-tx limit.
        gas: 3_000_000n,
      });

      console.log('Execute transaction initiated');

      toast({
        title: 'Proposal Execution',
        description: 'The transaction has been submitted.',
      });

      // Note: txHash will be set by the useEffect that watches for txHash changes
      setRefetchKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Error executing proposal:', error);
      setQueueExecuteError(error?.message || 'An error occurred while executing the proposal');

      toast({
        title: 'Execution Failed',
        description: error?.message || 'An error occurred while executing the proposal',
        variant: 'destructive',
      });
      setIsExecuting(false);
    }
  };

  // Vote confirmation handler.
  //
  // IMPORTANT: only act on a SUCCESSFUL receipt. `useWaitForTransactionReceipt`
  // also resolves for REVERTED txs (e.g. "already voted") — recording those was
  // the source of the "ghost votes". We no longer write votes to Supabase at all:
  // the vote totals and Vote History are read from on-chain `VoteCast` (subgraph
  // on mainnet, logs on testnet), so ghosts are structurally impossible. We only
  // update local UI state and re-read the chain.
  useEffect(() => {
    // Only react to a VOTE tx — the shared write hook is also used by queue/execute,
    // and reacting to those here is what created phantom ABSTAIN rows from queue txs.
    if (receipt && txHash && receipt.status === 'success' && lastActionRef.current === 'vote') {
      lastActionRef.current = null;
      setIsSubmitting(false);
      setUserVote(voteDirection);
      refreshProposalData(); // subgraph (mainnet) / on-chain (testnet): updates votes + has-voted
      setRefetchKey(prev => prev + 1); // refresh on-chain vote history
    }
  }, [receipt, txHash, voteDirection]);

  // Reset in-flight state when any write (vote/queue/execute) fails at submit time
  // (e.g. wallet rejection). Without this the controls stay stuck/hidden.
  useEffect(() => {
    if (writeError) {
      console.error('Write failed:', writeError);
      lastActionRef.current = null;
      setIsSubmitting(false);
      setIsQueueing(false);
      setIsExecuting(false);
      const msg = (writeError as { shortMessage?: string }).shortMessage || writeError.message;
      toast({
        title: 'Transaction failed',
        description: /user rejected|denied/i.test(msg) ? 'You rejected the transaction.' : msg,
        variant: 'destructive',
      });
    }
  }, [writeError]);

  // Helper function to format addresses for display
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Get vote type text and color
  const getVoteTypeInfo = (support: number): { text: string; color: string } => {
    switch (support) {
      case 0:
        return { text: 'AGAINST', color: 'text-red-600' };
      case 1:
        return { text: 'FOR', color: 'text-green-600' };
      case 2:
        return { text: 'ABSTAIN', color: 'text-muted-foreground' };
      default:
        return { text: 'UNKNOWN', color: 'text-muted-foreground' };
    }
  };

  // Add useEffect to fetch vote totals from database
  useEffect(() => {
    if (id) {
      const fetchVoteTotals = async () => {
        try {
          const { data: proposal, error } = await supabase
            .from('proposals')
            .select('votes_for, votes_against, votes_abstain')
            .eq('proposal_id', id)
            .single();

          if (error) {
            console.error('Error fetching vote totals:', error);
            return;
          }

          if (proposal) {
            console.log('Fetched DB vote totals:', proposal);
            setDbVoteTotals({
              votes_for: proposal.votes_for || 0,
              votes_against: proposal.votes_against || 0,
              votes_abstain: proposal.votes_abstain || 0
            });
          }
        } catch (err) {
          console.error('Failed to fetch vote totals:', err);
        }
      };

      fetchVoteTotals();
    }
  }, [id, refetchKey]); // Add refetchKey to refresh after voting

  // (Removed) the old effect that recomputed proposals.votes_* by summing
  // votes_history and wrote it back — it zeroed totals when history was empty and
  // re-injected ghost rows. Vote totals now come from on-chain proposalVotes().

  // Helper function to display vote type
  const displayVoteType = (vote: "for" | "against" | "abstain" | null) => {
    if (!vote) return "";
    return vote.charAt(0).toUpperCase() + vote.slice(1);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!proposalData) return <div>Proposal not found</div>;

  return (
    <div className="w-full max-w-4xl mx-auto bg-card p-6 rounded-lg shadow-sm">
      {/* Back button */}
      <Link
        to="/proposals"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Proposals
      </Link>

      {/* Proposal header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <h1 className="text-2xl font-bold text-foreground">{proposalData?.title}</h1>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
            >
              {getProposalState(state !== undefined ? Number(state) : (proposalData?.state ?? 0))}
            </span>
            {Number(state) === 0 && snapshot && currentBlock && (
              <div className="text-xs text-muted-foreground">
                <CountdownTimer
                  targetBlock={Number(snapshot)}
                  currentBlock={Number(currentBlock)}
                  type="badge"
                />
              </div>
            )}
            {Number(state) === 1 && deadline && currentBlock && (
              <div className="text-xs text-muted-foreground">
                <CountdownTimer
                  targetBlock={Number(deadline)}
                  currentBlock={Number(currentBlock)}
                  type="badge"
                />
              </div>
            )}
          </div>
        </div>
        <p className="text-muted-foreground mt-2">{proposalData?.description}</p>
      </div>

      {/* Subgraph outage: we've transparently fallen back to on-chain reads, but tell
          the user why data may load a little slower than usual (audit H1). */}
      {subgraphUnavailable && (
        <Alert className="mb-6 border-amber-500/40 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertTitle className="text-amber-300">Live indexer unavailable</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            The DAO indexer isn't responding right now, so vote totals, quorum and status
            are being read directly from the blockchain. Everything still works — voting,
            queueing and execution are unaffected — it may just refresh a little slower.
          </AlertDescription>
        </Alert>
      )}

      {/* Lifecycle / next-step panel: surfaces queue/execute actions after a vote */}
      {state !== undefined && ![0, 1].includes(Number(state)) && (() => {
        // Authorized exception: these early test proposals are shown as Passed
        // regardless of on-chain state (see specialProposalIds).
        if (specialProposalIds.includes(id || '')) {
          return (
            <Card className="mb-6 border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <h3 className="text-lg font-medium">Passed</h3>
                    <p className="text-sm text-muted-foreground mt-1">This proposal passed.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        const etaSeconds = proposalEta ? Number(proposalEta) : undefined;
        const step = getProposalLifecycleStep({
          state: Number(state),
          proposalEta: etaSeconds,
          nowSeconds: Date.now() / 1000,
        });

        const accentByPhase: Record<string, string> = {
          succeeded: 'border-l-amber-500',
          'queued-waiting': 'border-l-blue-500',
          'queued-ready': 'border-l-purple-500',
          executed: 'border-l-green-500',
          defeated: 'border-l-red-500',
          canceled: 'border-l-gray-400',
          expired: 'border-l-gray-400',
          unknown: 'border-l-gray-400',
        };

        const renderIcon = () => {
          switch (step.phase) {
            case 'executed':
              return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'queued-waiting':
              return <Clock className="h-5 w-5 text-amber-400" />;
            case 'defeated':
            case 'canceled':
            case 'expired':
              return <XCircle className="h-5 w-5 text-muted-foreground" />;
            default:
              return <AlertCircle className="h-5 w-5 text-amber-600" />;
          }
        };

        // Don't prompt Execute until the timelock eta has loaded.
        const etaPending = Number(state) === 5 && etaSeconds === undefined;
        const showCta = step.actionRequired && !etaPending;

        return (
          <Card className={`mb-6 border-l-4 ${accentByPhase[step.phase] || 'border-l-gray-400'}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {renderIcon()}
                <div className="flex-1">
                  <h3 className="text-lg font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>

                  {step.phase === 'queued-waiting' && etaSeconds !== undefined && (
                    <div className="mt-3">
                      <CountdownTimer
                        targetTimestamp={etaSeconds}
                        currentBlock={Number(currentBlock)}
                        label="Execution available in:"
                        type="detail"
                      />
                    </div>
                  )}

                  {etaPending && (
                    <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking timelock status…
                    </p>
                  )}

                  {showCta && (
                    <div className="mt-4">
                      {!isConnected ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            Connect your wallet to {step.cta} this proposal:
                          </span>
                          <WalletButton />
                        </div>
                      ) : step.cta === 'queue' ? (
                        <Button
                          onClick={handleQueue}
                          disabled={isQueueing || isConfirming}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          {isQueueing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirm in wallet…</>
                          ) : isConfirming ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Queueing on-chain…</>
                          ) : 'Queue proposal'}
                        </Button>
                      ) : step.cta === 'execute' ? (
                        <Button
                          onClick={handleExecute}
                          disabled={isExecuting || isConfirming}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {isExecuting ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirm in wallet…</>
                          ) : isConfirming ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executing on-chain…</>
                          ) : 'Execute proposal'}
                        </Button>
                      ) : null}
                      {queueExecuteError && (
                        <p className="text-sm text-red-600 mt-2">{queueExecuteError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Proposal metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Proposed: {formatDate(proposalData?.created_at || "")}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Voting Ends: {deadline ? `~${formatDate(Number(deadline))}` : 'Not set'}</span>
        </div>
      </div>

      {/* Voting progress */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Voting Progress</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                {getProposalState(state !== undefined ? Number(state) : (proposalData?.state ?? 0))}
              </span>
            </div>
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4 text-green-600" />
                  <span>
                    {formatVoteNumber(formattedForVotes)} ({forPercentage.toFixed(2)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  <span>
                    {formatVoteNumber(formattedAgainstVotes)} ({againstPercentage.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <Progress value={forPercentage} className="h-2" />
            </div>

            <div className="flex justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{formatVoteNumber(totalVotes)} total votes</span>
              </div>
              {userVotingPower > 0 && (
                <div>
                  Your voting power for this proposal: {formatVoteNumber(userVotingPower)}
                </div>
              )}
            </div>

            {/* Quorum status (on-chain). A proposal can have majority support and
                still fail if quorum isn't met. */}
            {quorumRequired !== null && (() => {
              const isSpecial = specialProposalIds.includes(id || '');
              const met = isSpecial || quorumMet;
              return (
                <div className="rounded-md border p-3 bg-secondary">
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-medium">Quorum</span>
                    <span className={met ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                      {met ? '✓ Quorum reached' : 'Not yet reached'}
                    </span>
                  </div>
                  {!isSpecial && (
                    <>
                      <Progress value={quorumProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>
                          {formatVoteNumber(Math.round(quorumCurrent))} of{' '}
                          {formatVoteNumber(Math.round(quorumRequired))} votes needed
                        </span>
                        <span>{quorumProgress.toFixed(1)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        On-chain For + Abstain votes count toward quorum.
                      </p>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Voting buttons */}
            {canVote() ? (
              <div className="pt-4">
                {isConnected ? (
                  userVote ? (
                    <div className="bg-secondary p-4 rounded-md">
                      <p className="text-sm text-muted-foreground">
                        You voted {displayVoteType(userVote)} this proposal with {formatVoteNumber(userVotingPower)} voting power.
                      </p>
                    </div>
                  ) : isSubmitting ? (
                    <div className="bg-secondary p-4 rounded-md">
                      <p className="text-sm text-muted-foreground">
                        {voteStatus || "Processing vote..."}
                      </p>
                      {/* Show transaction status if available */}
                      {queueExecuteHash && (
                        <p className="text-xs text-amber-400 mt-2">
                          Transaction: {queueExecuteHash.slice(0, 10)}...{queueExecuteHash.slice(-8)}
                        </p>
                      )}
                    </div>
                  ) : isDelegated ? (
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleVote("for")}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Vote For
                      </Button>
                      <Button
                        onClick={() => handleVote("abstain")}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white"
                        variant="secondary"
                      >
                        <MinusCircle className="h-4 w-4 mr-2" />
                        Abstain
                      </Button>
                      <Button
                        onClick={() => handleVote("against")}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Vote Against
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-secondary p-4 rounded-md">
                      <p className="text-sm text-muted-foreground mb-4">
                        You need to delegate your voting power before you can vote.
                        {delegateError && (
                          <span className="text-red-600 block mt-2">{delegateError}</span>
                        )}
                      </p>
                      <Button
                        onClick={handleDelegate}
                        disabled={isDelegating}
                        className="w-full"
                      >
                        {isDelegating ? 'Delegating...' : 'Delegate Voting Power'}
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="bg-secondary p-4 rounded-md text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Connect your wallet to vote on this proposal
                    </p>
                    <WalletButton />
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-4">
                <div className="bg-secondary p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    {isWrongNetwork ?
                      `This proposal is on KalyChain ${proposalChainId === 3889 ? 'Testnet' : 'Mainnet'}. Switch your wallet to that network to vote.` :
                      userVote ?
                      `You voted ${displayVoteType(userVote)} on this proposal with ${formatVoteNumber(userVotingPower)} voting power.` :
                      onChainHasVoted ?
                        'You have already voted on this proposal.' :
                        userVotingPower <= 0 ?
                          (acquiredAfterSnapshot ?
                            `Your gKLC was received or delegated after this proposal's snapshot (block ${snapshot ? Number(snapshot) : '—'}), so it cannot vote on this proposal. Voting power is locked in when a proposal is created — your tokens will count on every proposal created from now on.` :
                            'You need governance tokens (delegated before this proposal was created) to vote on this proposal.') :
                          Number(state) === 0 ?
                            'Voting has not started yet.' :
                            Number(state) === 1 ?
                              'You can vote on this proposal.' :
                              'This proposal has ended.'
                    }
                  </p>
                  {Number(state) === 0 && snapshot && currentBlock && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Current block:</span>
                        <span>{Number(currentBlock)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Voting starts at block:</span>
                        <span>{Number(snapshot)}</span>
                      </div>
                      <CountdownTimer
                        targetBlock={Number(snapshot)}
                        currentBlock={Number(currentBlock)}
                      />
                    </div>
                  )}
                  {Number(state) === 1 && deadline && currentBlock && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Current block:</span>
                        <span>{Number(currentBlock)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Voting ends at block:</span>
                        <span>{Number(deadline)}</span>
                      </div>
                      <CountdownTimer
                        targetBlock={Number(deadline)}
                        currentBlock={Number(currentBlock)}
                        label="Voting ends in:"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proposal details tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">Vote History</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-6">
          <div className="prose prose-invert max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-amber-400 hover:prose-a:underline prose-img:rounded-md">
            {proposalData?.full_description ? (
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm]}
              >
                {proposalData.full_description}
              </ReactMarkdown>
            ) : (
              proposalData?.description
            )}
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <div className="space-y-4">
            {isLoadingVotes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : voteHistory.length > 0 ? (
              voteHistory.map((vote) => {
                const voteType = getVoteTypeInfo(vote.support);
                return (
                  <div key={vote.id} className="bg-secondary p-4 rounded-md">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{formatAddress(vote.voter_address)}</span>
                        <span className={`ml-2 ${voteType.color} font-medium`}>
                          Voted {voteType.text}
                        </span>
                      </div>
                      <span className="text-sm">
                        {formatVoteNumber(vote.voting_power)} voting power
                      </span>
                    </div>
                    {vote.reason && (
                      <p className="text-sm text-gray-300 mt-2">
                        "{vote.reason}"
                      </p>
                    )}
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(vote.timestamp).toLocaleString()}
                      </span>
                      <a
                        href={`${currentChain.blockExplorers?.default.url}/tx/${vote.transaction_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:underline"
                      >
                        View Transaction
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No votes have been cast for this proposal yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="discussion" className="mt-6">
          <Discussion proposalId={proposalData.proposal_id} />
        </TabsContent>
      </Tabs>

      {/* Vote confirmation dialog */}
      <AlertDialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div>
                You are about to vote {voteDirection === 'abstain' ? 'ABSTAIN on' : ` ${voteDirection ? voteDirection.toUpperCase() : ''} `} this proposal
                with {formatVoteNumber(userVotingPower)} voting power.
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote-reason">Reason (optional)</Label>
                <Input
                  id="vote-reason"
                  placeholder="Enter your reason for voting..."
                  value={voteReason}
                  onChange={(e) => setVoteReason(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                This action cannot be undone.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmVote}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Confirming...' : 'Confirm Vote'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Queue/Execute actions are surfaced by the lifecycle panel near the top. */}

      {/* Display View Count */}
      {proposalData?.views_count !== undefined && (
        <div className="text-sm text-muted-foreground mt-2 text-right">
          Views: {proposalData.views_count}
        </div>
      )}
    </div>
  );
};
export default ProposalDetail;

