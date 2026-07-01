import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Separator } from "../ui/separator";
import { Users, Landmark, FileText, Vote as VoteIcon, CircleDashed, Pen, CheckCircle, Coins, HelpCircle, ArrowRight } from "lucide-react";
import { useDao } from "@/blockchain/hooks/useDao";
import { 
  useAccount, 
  useReadContract, 
  useChainId, 
  useBalance, 
  useBlockNumber
} from "wagmi";
import { formatUnits, formatEther, parseEther } from "viem";
import { CONTRACT_ADDRESSES_BY_NETWORK } from "@/blockchain/contracts/addresses";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { getDaoSubgraphUrl, queryGovernor } from "@/lib/daoSubgraph";
import { useBlockWatcher } from "@/components/BlockWatcher";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Define ABI fragments for reading DAO data
const governorABI = [
  {
    name: "proposalCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "quorumVotes",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "quorumNumerator",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "quorum",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "blockNumber", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getProposalsCount", // Alternative function name
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const tokenABI = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getVotesCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalHolders",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getPastVotes",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "blockNumber", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const treasuryABI = [
  {
    name: "getBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Define tooltip text for reuse
const QUORUM_TOOLTIP = "Quorum is the minimum number of votes required for a proposal to pass. It's calculated as a percentage of the total token supply at the time a proposal is created. This threshold is fixed for each proposal when it's submitted.";

interface DaoOverviewProps {
  title?: string;
  description?: string;
}

const DaoOverview = ({
  title = "KalyChain DAO Governance",
  description = "KalyChain DAO is a decentralized autonomous organization built on the KalyChain blockchain. Members can propose, discuss, and vote on important decisions affecting the protocol using gKLC tokens as voting power.",
}: DaoOverviewProps) => {
  const [statistics, setStatistics] = useState({
    totalSupply: 0,
    treasuryBalance: 0,
    proposalsCreated: 0,
    quorumRequirement: null as number | null,
    quorumPercentage: null as number | null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [supabaseProposals, setSupabaseProposals] = useState<number>(0);
  const [lastUpdatedBlock, setLastUpdatedBlock] = useState<bigint | null>(null);

  const { address } = useAccount();
  const chainId = useChainId();
  const { contracts } = useDao();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // Get the correct contract addresses based on current network
  const governorAddress = (chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNOR_CONTRACT
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNOR_CONTRACT) as `0x${string}`;

  const tokenAddress = (chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN) as `0x${string}`;

  const treasuryAddress = (chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.TREASURY_VAULT
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.TREASURY_VAULT) as `0x${string}`;

  // Function to fetch all data
  const fetchSupabaseProposals = useCallback(async () => {
    try {
      // Filter by chain so the count matches the per-network proposal lists.
      const { count, error } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('chain_id', chainId);

      if (error) {
        console.error('Error fetching proposals count from Supabase:', error);
        return;
      }

      setSupabaseProposals(count || 0);
    } catch (err) {
      console.error('Unexpected error fetching proposals:', err);
    }
  }, [chainId]);

  // Quorum config from the DAO subgraph (chain truth) on mainnet — replaces the
  // quorumNumerator / quorumVotes / quorum(block) RPC reads. Testnet has no subgraph,
  // so the on-chain reads below stay enabled there.
  const daoSubgraphUrl = getDaoSubgraphUrl(chainId);
  const hasDaoSubgraph = !!daoSubgraphUrl;
  const { data: sgGovernor } = useQuery({
    queryKey: ['daoGovernor', chainId],
    enabled: hasDaoSubgraph,
    staleTime: 5 * 60_000,
    queryFn: () => queryGovernor(daoSubgraphUrl as string),
  });

  // Get quorum requirement - try different possible functions (testnet fallback only)
  const { data: quorumVotes, isError: isQuorumVotesError } = useReadContract({
    address: governorAddress,
    abi: governorABI,
    functionName: 'quorumVotes',
    chainId,
    query: { enabled: !hasDaoSubgraph },
  });

  // Try to get quorum as percentage (quorumNumerator in OpenZeppelin Governor)
  const { data: quorumNumeratorOnChain, isError: isQuorumNumeratorError } = useReadContract({
    address: governorAddress,
    abi: governorABI,
    functionName: 'quorumNumerator',
    chainId,
    query: { enabled: !hasDaoSubgraph },
  });

  // If current block is available, try the quorum(blockNumber) function
  const { data: quorumAtBlock, isError: isQuorumAtBlockError } = useReadContract({
    address: governorAddress,
    abi: governorABI,
    functionName: 'quorum',
    args: blockNumber ? [blockNumber] : undefined,
    chainId,
    query: { enabled: !hasDaoSubgraph && !!blockNumber },
  });

  // Prefer the subgraph quorum fraction; fall back to the on-chain numerator on testnet.
  const quorumNumerator = hasDaoSubgraph ? sgGovernor?.quorumNumerator : quorumNumeratorOnChain;
  const quorumDenominator = hasDaoSubgraph ? sgGovernor?.quorumDenominator : undefined;

  // Standard wagmi hooks for other data
  const { data: totalSupply, isError: isTotalSupplyError } = useReadContract({
    address: tokenAddress,
    abi: tokenABI,
    functionName: 'totalSupply',
    chainId,
  });

  const { data: votesCount, isError: isVotesCountError } = useReadContract({
    address: tokenAddress,
    abi: tokenABI,
    functionName: 'getVotesCount',
    chainId,
  });

  const { data: userTokenBalance, isError: isUserTokenBalanceError } = useReadContract({
    address: tokenAddress,
    abi: tokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
  });

  // Get treasury balance with refetch capability
  const { 
    data: treasuryBalance,
    refetch: refetchTreasuryBalance,
    isError: isTreasuryBalanceError 
  } = useBalance({
    address: treasuryAddress,
    chainId,
  });

  // Use the BlockWatcher hook to refresh data when new blocks are mined
  useBlockWatcher((newBlockNumber) => {
    console.log(`New block detected in DaoOverview: ${newBlockNumber}`);
    if (!lastUpdatedBlock || newBlockNumber > lastUpdatedBlock) {
      setLastUpdatedBlock(newBlockNumber);
      
      // Refresh balances directly using the refetch function
      console.log("Refreshing treasury balance...");
      refetchTreasuryBalance();
      
      // Fetch proposals from Supabase
      fetchSupabaseProposals();
    }
  });

  // Initial data fetch on component mount
  useEffect(() => {
    fetchSupabaseProposals();
    refetchTreasuryBalance();
  }, [fetchSupabaseProposals, refetchTreasuryBalance]);

  // Log current network
  useEffect(() => {
    console.log("Current chainId:", chainId);
    console.log("Expected testnet chainId:", 3889);
    console.log("Is on testnet:", chainId === 3889);
  }, [chainId]);

  useEffect(() => {
    console.log("Contract addresses:", {
      governorAddress,
      tokenAddress,
      treasuryAddress
    });
  }, [governorAddress, tokenAddress, treasuryAddress]);

  // Log raw data from contracts for debugging
  useEffect(() => {
    console.log("Blockchain data:", {
      blockNumber: blockNumber?.toString(),
      lastUpdatedBlock: lastUpdatedBlock?.toString(),
      totalSupply: totalSupply ? formatUnits(totalSupply, 18) : null,
      quorumVotes: quorumVotes ? formatUnits(quorumVotes, 18) : null,
      quorumNumerator: quorumNumerator?.toString(),
      quorumAtBlock: quorumAtBlock ? formatUnits(quorumAtBlock, 18) : null,
      votesCount,
      userTokenBalance: userTokenBalance ? formatUnits(userTokenBalance, 18) : null,
      treasuryBalance: treasuryBalance ? formatUnits(treasuryBalance.value, 18) : "0",
      supabaseProposals,
      errors: {
        totalSupply: isTotalSupplyError ? "Error fetching total supply" : null,
        quorumVotes: isQuorumVotesError ? "Error fetching quorum votes" : null,
        quorumNumerator: isQuorumNumeratorError ? "Error fetching quorum numerator" : null,
        quorumAtBlock: isQuorumAtBlockError ? "Error fetching quorum at block" : null,
        votesCount: isVotesCountError ? "Error fetching votes count" : null,
        userTokenBalance: isUserTokenBalanceError ? "Error fetching user token balance" : null,
        treasuryBalance: isTreasuryBalanceError ? "Error fetching treasury balance" : null,
      }
    });
  }, [
    blockNumber, lastUpdatedBlock, totalSupply, quorumVotes, quorumNumerator, quorumAtBlock, votesCount, userTokenBalance,
    treasuryBalance, supabaseProposals,
    isTotalSupplyError, isQuorumVotesError, isQuorumNumeratorError, isQuorumAtBlockError, isVotesCountError, isUserTokenBalanceError, isTreasuryBalanceError
  ]);

  // Calculate total number of holders
  const calculateTotalHolders = () => {
    // If user has a token balance, count at least 1 member
    if (userTokenBalance && Number(userTokenBalance) > 0) {
      return 1;
    }
    return 0;
  };

  // Get the quorum value from available sources
  const calculateQuorumRequirement = () => {
    // Store the percentage for display
    let quorumPercentage = 0;
    
    // If we have a quorum fraction and total supply, calculate actual quorum.
    // numerator/denominator come from the subgraph on mainnet (default 4/100).
    if (quorumNumerator && totalSupply) {
      const divisor = quorumDenominator && quorumDenominator > 0n ? quorumDenominator : 100n;
      quorumPercentage = (Number(quorumNumerator) * 100) / Number(divisor);
      console.log(`Quorum set to ${quorumPercentage}% of total supply`);

      // quorum = totalSupply * numerator / denominator
      const calculatedQuorum = (BigInt(totalSupply) * BigInt(quorumNumerator)) / divisor;
      return {
        amount: Number(formatUnits(calculatedQuorum, 18)),
        percentage: quorumPercentage
      };
    }
    
    // Next, try direct quorum values
    if (quorumVotes) {
      console.log(`Direct quorumVotes: ${formatUnits(quorumVotes, 18)} KLC`);
      // Estimate percentage from quorumVotes if we have totalSupply
      if (totalSupply) {
        quorumPercentage = (Number(quorumVotes) * 100) / Number(totalSupply);
      }
      return { 
        amount: Number(formatUnits(quorumVotes, 18)),
        percentage: quorumPercentage
      };
    }
    
    if (quorumAtBlock) {
      console.log(`Quorum at current block: ${formatUnits(quorumAtBlock, 18)} KLC`);
      // Estimate percentage from quorumAtBlock if we have totalSupply
      if (totalSupply) {
        quorumPercentage = (Number(quorumAtBlock) * 100) / Number(totalSupply);
      }
      return { 
        amount: Number(formatUnits(quorumAtBlock, 18)),
        percentage: quorumPercentage
      };
    }
    
    // No on-chain quorum source resolved. Do NOT invent a number (the old code
    // fabricated "4%", which could be flat wrong) — report it as unknown so the UI
    // shows "—" instead of a fake value.
    console.warn('Quorum unavailable: no on-chain quorum source resolved');
    return { amount: null, percentage: null };
  };

  // Update statistics when data changes
  useEffect(() => {
    // Get total supply of tokens
    const totalTokenSupply = totalSupply ? Number(formatUnits(totalSupply, 18)) : 0;
    
    // Get quorum requirement with percentage
    const quorum = calculateQuorumRequirement();

    // Use the treasury balance from the hook
    const treasuryValue = treasuryBalance?.value || 0n;

    // Update statistics with all available data
    setStatistics({
      totalSupply: totalTokenSupply,
      treasuryBalance: Number(formatUnits(treasuryValue, 18)),
      proposalsCreated: supabaseProposals,
      quorumRequirement: quorum.amount,
      quorumPercentage: quorum.percentage,
    });
    
    setIsLoading(false);
  }, [blockNumber, lastUpdatedBlock, totalSupply, quorumVotes, quorumNumerator, quorumDenominator, quorumAtBlock, userTokenBalance, treasuryBalance, supabaseProposals]);

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-foreground">
          {title}
        </CardTitle>
        <div className="mt-2">
          <CardDescription className="text-muted-foreground">
            {description}
          </CardDescription>
          <div className="mt-3">
            <p className="text-sm text-gray-300 mb-2">
              <strong>Important:</strong> To participate in governance, you need to wrap your KLC tokens to gKLC at a 1:1 ratio. 
              Only gKLC tokens can be used for creating proposals and voting.
            </p>
            <Link to="/wrap-klc">
              <Button variant="outline" size="sm" className="flex items-center gap-1 mt-1">
                Wrap KLC to gKLC 
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <StatCard
            title="Total Token Supply"
            value={`${statistics.totalSupply?.toLocaleString()} gKLC`}
            icon="coins"
            isLoading={isLoading}
          />
          <StatCard
            title="Treasury Balance"
            value={`${statistics.treasuryBalance?.toLocaleString()} KLC`}
            icon="landmark"
            isLoading={isLoading}
          />
          <StatCard
            title="Proposals Created"
            value={statistics.proposalsCreated?.toLocaleString() || "0"}
            icon="fileText"
            isLoading={isLoading}
          />
          <div className="bg-secondary p-4 rounded-lg border border-border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-1">
                  <p className="text-sm font-medium text-muted-foreground">Quorum Requirement</p>
                  <div className="group relative cursor-help">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded p-2 w-64 z-10">
                      {QUORUM_TOOLTIP}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black"></div>
                    </div>
                  </div>
                </div>
                {isLoading ? (
                  <div className="h-7 w-24 bg-gray-200 animate-pulse rounded"></div>
                ) : (
                  <p className="text-xl font-bold text-foreground">
                    {statistics.quorumRequirement != null && statistics.quorumPercentage != null
                      ? `${statistics.quorumRequirement.toLocaleString()} gKLC (${statistics.quorumPercentage}%)`
                      : '—'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Governance Process
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProcessStep
              number="01"
              title="Create Proposal"
              description="Any member with sufficient KLC tokens can create a governance proposal."
            />
            <ProcessStep
              number="02"
              title="Community Discussion"
              description="Proposals enter a discussion period where the community can provide feedback."
            />
            <ProcessStep
              number="03"
              title="Voting Period"
              description="Members vote using their KLC tokens, with one token equaling one vote."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  isLoading?: boolean;
  tooltip?: string;
}

const StatCard = ({ title, value, icon, isLoading = false, tooltip }: StatCardProps) => {
  // Return the appropriate icon based on the icon prop
  const getIcon = () => {
    switch (icon) {
      case 'users':
        return <Users className="h-5 w-5 text-primary" />;
      case 'coins':
        return <Coins className="h-5 w-5 text-primary" />;
      case 'landmark':
        return <Landmark className="h-5 w-5 text-primary" />;
      case 'fileText':
        return <FileText className="h-5 w-5 text-primary" />;
      case 'vote':
        return <VoteIcon className="h-5 w-5 text-primary" />;
      case 'pen':
        return <Pen className="h-5 w-5 text-primary" />;
      case 'checkCircle':
        return <CheckCircle className="h-5 w-5 text-primary" />;
      default:
        return <CircleDashed className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <div className="stat-card p-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-primary/10 rounded-full">
          {getIcon()}
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-2">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {isLoading ? (
            <div className="h-7 w-24 bg-secondary animate-pulse rounded"></div>
          ) : (
            <p className="text-xl font-bold text-foreground figure-glow">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface ProcessStepProps {
  number: string;
  title: string;
  description: string;
}

const ProcessStep = ({ number, title, description }: ProcessStepProps) => {
  return (
    <div className="flex space-x-4">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
          {number}
        </div>
      </div>
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
};

export default DaoOverview;
