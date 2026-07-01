import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, Info, ExternalLink } from "lucide-react";
import { 
  useAccount, 
  useBalance,
  useChainId,
  useWriteContract,
  useTransaction,
  type BaseError,
  useReadContract
} from 'wagmi';
import { type Abi } from 'viem';
import { WalletButton } from '@/components/WalletButton';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { kalyChainMainnet, kalyChainTestnet } from '@/blockchain/config/chains';
import { getTransactionGasConfig } from '@/blockchain/config/transaction';
import { parseEther } from 'viem';
import { supabase } from '@/lib/supabase';
import { useDao } from '@/blockchain/hooks/useDao';
import { toast } from "@/components/ui/use-toast";
import { ethers } from 'ethers';
// UI Components
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// Import the new ActionBuilder
import ActionBuilder from './ActionBuilder';
import { buildSignalingAction, isValidActionTarget } from '@/lib/proposals';

type ProposalType = 'signaling' | 'action';

interface CreateProposalProps {
  minProposalThreshold?: number;
}

// Define the structure for a single action
const actionSchema = z.object({
  target: z.string().refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val) || val === '', { // Allow empty string initially
    message: "Invalid Ethereum address",
  }),
  value: z.string().refine((val) => /^\d+$/.test(val), { // Store as string initially, convert to bigint later
    message: "Value must be a non-negative integer (in Wei)",
  }),
  calldata: z.string().refine((val) => /^0x[a-fA-F0-9]*$/.test(val), {
    message: "Calldata must be a valid hex string (0x...)",
  }),
});

// Update form schema
const formSchema = z.object({
  title: z.string().min(10).max(100),
  summary: z.string().min(20).max(250),
  description: z.string().min(100),
  fullDescription: z.string().min(200),
  category: z.string().min(1, { message: "Category is required" }), // Make category required
  votingPeriod: z.string().optional(), // Keep votingPeriod optional for now, contract sets it
  // Remove old fields
  // targets: z.string().optional(),
  // values: z.string().optional(),
  // calldatas: z.string().optional()
  // Add actions array, make it optional for non-treasury proposals
  actions: z.array(actionSchema).optional(),
});

// Update FormData type
type FormData = z.infer<typeof formSchema>;

// Live character counter for the min/max-limited text fields. Shows the requirement
// up front and updates as the user types, so a too-short entry is obvious before submit.
const CharCount = ({ value, min, max }: { value?: string; min: number; max?: number }) => {
  const len = value?.length ?? 0;
  const belowMin = len < min;
  const overMax = max !== undefined && len > max;
  const color = belowMin || overMax ? 'text-red-500' : 'text-green-500';
  const hint = belowMin
    ? `${min - len} more needed`
    : overMax
      ? `${len - max} over max`
      : 'ok';
  return (
    <span className={`text-xs font-medium tabular-nums ${color}`}>
      {len}/{min}{max ? `–${max}` : '+'} · {hint}
    </span>
  );
};

// Define minimal ABI for the propose function
// Remove the existing governorABI since we'll use the useDao hook

// Add this interface at the top of the file after imports
interface Window {
  ethereum?: {
    request: (args: { method: string, params?: any[] }) => Promise<any>;
    isMetaMask?: boolean;
  };
}

// Define the governor ABI once at the top level
const governorAbi = [
  {
    inputs: [
      { type: 'address[]', name: 'targets' },
      { type: 'uint256[]', name: 'values' },
      { type: 'bytes[]', name: 'calldatas' },
      { type: 'string', name: 'description' }
    ],
    name: 'propose',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'votingDelay',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'votingPeriod',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const CreateProposal = ({
  minProposalThreshold = 100000,
}: CreateProposalProps) => {
  const navigate = useNavigate();
  // Using toast imported from "@/components/ui/use-toast"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalType, setProposalType] = useState<ProposalType>('signaling');
  // Exact actions we submitted on-chain, kept so the Supabase record (used later
  // for queue/execute) stores params identical to what we proposed.
  const submittedActionsRef = useRef<{ targets: string[]; values: string[]; calldatas: string[] } | null>(null);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [proposalId, setProposalId] = useState<string>();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { contracts } = useDao();
  
  // Get the correct token address based on current network
  const governanceTokenAddress = chainId === 3889 
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN;

  const { data: balance, isError: balanceError, isLoading: balanceLoading } = useBalance({
    address,
    token: governanceTokenAddress,
  });

  // Debug logging
  useEffect(() => {
    if (isConnected && address) {
      console.log('Wallet connected:', address);
      console.log('Chain ID:', chainId);
      console.log('Governance Token Address:', governanceTokenAddress);
      console.log('Balance data:', balance);
      if (balanceError) {
        console.error('Balance Error:', balanceError);
      }
    }
  }, [balance, chainId, governanceTokenAddress, balanceError, isConnected, address]);

  // Proposing power is delegated getVotes(), NOT raw balance. A holder who never
  // self-delegated has a balance but 0 votes; gating on balance let them pass the UI
  // and then revert on-chain. We also detect that case to prompt delegation.
  const { data: votesRaw } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: [
      {
        name: 'getVotes',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const tokenBalance = balance ? parseFloat(balance.formatted) : 0;
  const userVotingPower = votesRaw !== undefined ? Number(votesRaw) / 1e18 : 0; // display only
  // Compare in EXACT wei, not floats: Number(100000e18)/1e18 rounds to 99999.9999…,
  // so a holder with exactly the threshold would wrongly fail `>= minProposalThreshold`.
  const thresholdRaw = BigInt(Math.floor(minProposalThreshold)) * 10n ** 18n;
  const hasEnoughVotingPower = votesRaw !== undefined && (votesRaw as bigint) >= thresholdRaw;
  // Holds tokens but hasn't activated enough of them by delegating.
  const needsDelegation = tokenBalance > 0 && !hasEnoughVotingPower;

  // Get the correct governor contract address based on current network
  const governorAddress = chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNOR_CONTRACT
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNOR_CONTRACT;

  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();

  // Surface wallet rejection / write failure. Without this the button stays stuck on
  // "Creating Proposal…" forever (writeContract doesn't throw; the failure lands here).
  useEffect(() => {
    if (writeError) {
      console.error('Proposal write failed:', writeError);
      setIsSubmitting(false);
      const msg = (writeError as { shortMessage?: string }).shortMessage || writeError.message;
      toast({
        title: 'Transaction failed',
        description: /user rejected|denied/i.test(msg) ? 'You rejected the transaction.' : msg,
        variant: 'destructive',
      });
    }
  }, [writeError]);


  const { data: votingDelay } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorAbi,
    functionName: 'votingDelay',
    chainId,
    account: address
  });

  const { data: votingPeriod } = useReadContract({
    address: governorAddress as `0x${string}`,
    abi: governorAbi,
    functionName: 'votingPeriod',
    chainId,
    account: address
  });

  // Helper function to format blocks to days (assuming 2-second block time)
  const formatBlocksToDays = (blocks: bigint | undefined): string => {
    if (!blocks) return '...';
    const BLOCKS_PER_DAY = 43200; // 2-second blocks = 43200 blocks per day
    const days = Number(blocks) / BLOCKS_PER_DAY;
    return days.toFixed(1);
  };

  useEffect(() => {
    if (hash) {
      setTxHash(hash);
      console.log('Transaction hash set:', hash);
      
      // When we have a hash, we can wait for the transaction receipt
      const processTransaction = async () => {
        try {
          // Wait for the receipt by POLLING getTransactionReceipt directly. ethers'
          // waitForTransaction() leans on the provider's internal polling/event loop,
          // which stalls forever when the (flaky) testnet RPC hiccups — leaving the UI
          // stuck on "Creating Proposal...". A direct poll tolerates transient errors
          // and is bounded by a hard timeout so the flow always resolves.
          const provider = new ethers.providers.JsonRpcProvider((chainId === 3889 ? kalyChainTestnet : kalyChainMainnet).rpcUrls.default.http[0]);
          console.log('Waiting for transaction confirmation...');
          let receipt: ethers.providers.TransactionReceipt | null = null;
          const deadline = Date.now() + 150_000; // up to 2.5 min
          while (Date.now() < deadline) {
            try {
              receipt = await provider.getTransactionReceipt(hash);
            } catch (pollErr) {
              console.warn('Receipt poll hiccup (will retry):', pollErr);
            }
            if (receipt) break;
            await new Promise((r) => setTimeout(r, 3000));
          }
          if (!receipt) {
            throw new Error(
              'Timed out waiting for confirmation. The proposal may still have been created — check the Proposals page in a moment.',
            );
          }
          console.log('Transaction confirmed!', receipt);
          
          const proposalId = await processTransactionReceipt(receipt);
          
          if (proposalId) {
            console.log('Proposal created successfully with ID:', proposalId);
            
            // Get proposal data from blockchain before saving to Supabase
            try {
              const onChainData = await getProposalFromBlockchain(proposalId);
              console.log('Retrieved on-chain data:', onChainData);
              
              // Add UI-specific data from form
              const formValues = form.getValues();
              
              // Prepare action data for Supabase
              // Convert values to strings
              // Prefer the exact actions we submitted (signaling no-op or the
              // validated action set) so the stored params match the on-chain
              // proposal; fall back to raw form values only if unavailable.
              const submitted = submittedActionsRef.current;
              let supabaseTargets: string[] = submitted?.targets ?? [];
              let supabaseValues: string[] = submitted?.values ?? [];
              let supabaseCalldatas: string[] = submitted?.calldatas ?? [];

              if (!submitted && formValues.actions) {
                  supabaseTargets = formValues.actions.map(action => action.target);
                  supabaseValues = formValues.actions.map(action => action.value); // Already strings from form
                  supabaseCalldatas = formValues.actions.map(action => action.calldata);
              }

              // Combine description and fullDescription for on-chain storage
              // We need to save the exact string used for the proposal description hash
              const fullProposalText = `# ${formValues.title}\n\n## Summary\n${formValues.summary}\n\n## Description\n${formValues.description}\n\n## Full Description\n${formValues.fullDescription}`;

              // Create proposal data object
              // Convert numeric state to appropriate format based on schema
              const stateValue = onChainData.state.toString();
              
              // Map numeric state to string state for better compatibility
              // 0 = Pending, 1 = Active, 2 = Canceled, 3 = Defeated, 4 = Succeeded, 5 = Queued, 6 = Expired, 7 = Executed
              const stateMap: Record<string, string> = {
                '0': 'Pending',
                '1': 'Active',
                '2': 'Canceled',
                '3': 'Defeated', 
                '4': 'Succeeded',
                '5': 'Queued',
                '6': 'Expired',
                '7': 'Executed'
              };
              
              const completeData = {
                proposal_id: proposalId,
                title: formValues.title,
                summary: formValues.summary || '',
                description: formValues.description,
                full_description: fullProposalText, // Save the full text used for hashing
                proposer_address: onChainData.proposer,
                created_by: address || '',
                chain_id: chainId,
                state: stateMap[stateValue] || 'Pending', // Use string state value
                votes_for: 0,
                votes_against: 0,
                votes_abstain: 0,
                category: formValues.category || '',
                tags: [],
                snapshot_timestamp: Number(onChainData.snapshot),
                deadline_timestamp: Number(onChainData.deadline),
                views_count: 0,
                // Add the action data
                targets: supabaseTargets,
                values: supabaseValues,
                calldatas: supabaseCalldatas,
              };
              
              // Save the complete data to Supabase
              const saveResult = await saveToSupabase(completeData);
              
              if (saveResult) {
                toast({
                  title: 'Proposal Created',
                  description: 'Your proposal has been created successfully!',
                  variant: 'default',
                });
              } else {
                console.warn('Transaction succeeded but saving to database failed.');
                toast({
                  title: 'Transaction Succeeded',
                  description: 'Your proposal was created, but we could not save details to the database. Please check the Proposals page.',
                  variant: 'default',
                });
                
                // Navigate to proposals list as fallback
                setTimeout(() => {
                  navigate('/proposals');
                }, 1000);
              }
            } catch (err) {
              console.error('Error getting on-chain data or saving to Supabase:', err);
              toast({
                title: 'Error',
                description: 'Your proposal was created on-chain, but we could not save the details to our database.',
                variant: 'destructive',
              });
              
              // Navigate to proposals list as fallback
              setTimeout(() => {
                navigate('/proposals');
              }, 1000);
            }
          } else {
            console.warn('Transaction succeeded but proposal ID could not be extracted.');
            toast({
              title: 'Transaction Succeeded',
              description: 'Your proposal was created, but we could not extract the proposal ID. Please check the Proposals page.',
              variant: 'default',
            });
            
            // Navigate to proposals list as fallback
            setTimeout(() => {
              navigate('/proposals');
            }, 1000);
          }
        } catch (err) {
          console.error('Error processing transaction:', err);
          setError(err instanceof Error ? err.message : 'Unknown error processing transaction');
          toast({
            title: 'Transaction Failed',
            description: err instanceof Error ? err.message : 'Unknown error processing transaction',
            variant: 'destructive',
          });
        } finally {
          setIsSubmitting(false);
        }
      };
      
      processTransaction();
    }
  }, [hash]);

  // Function to query proposal data directly from the blockchain
  const getProposalFromBlockchain = async (proposalId: string) => {
    try {
      console.log('Getting on-chain data for proposal:', proposalId);
      
      // Create provider and contract instances
      const provider = new ethers.providers.JsonRpcProvider((chainId === 3889 ? kalyChainTestnet : kalyChainMainnet).rpcUrls.default.http[0]);
      
      // Get governor contract instance
      const governorContract = new ethers.Contract(
        governorAddress,
        [
          {
            name: 'proposalProposer',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'proposalId', type: 'uint256' }],
            outputs: [{ name: '', type: 'address' }]
          },
          {
            name: 'state',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'proposalId', type: 'uint256' }],
            outputs: [{ name: '', type: 'uint8' }]
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
          }
        ],
        provider
      );
      
      console.log('Querying governor contract at:', governorAddress);
      
      // Get proposer address
      const proposer = await governorContract.proposalProposer(proposalId);
      console.log('Proposal proposer:', proposer);
      
      // Get proposal state
      const state = await governorContract.state(proposalId);
      console.log('Proposal state:', state);

      // Get snapshot and deadline
      const snapshot = await governorContract.proposalSnapshot(proposalId);
      const deadline = await governorContract.proposalDeadline(proposalId);
      console.log('Proposal snapshot:', snapshot.toString());
      console.log('Proposal deadline:', deadline.toString());
      
      return {
        proposer,
        state,
        snapshot: snapshot.toString(),
        deadline: deadline.toString()
      };
    } catch (error) {
      console.error('Error querying blockchain for proposal data:', error);
      // If we can't get on-chain data, return fallback data
      return {
        proposer: address || '0x0000000000000000000000000000000000000000',
        state: 0,
        snapshot: '0',
        deadline: '0'
      };
    }
  };

  const processTransactionReceipt = async (receipt: any) => {
    console.log('Receipt logs:', JSON.stringify(receipt.logs, null, 2));
    
    // Ensure we have logs
    if (!receipt.logs || receipt.logs.length === 0) {
      console.error('No logs found in transaction receipt');
      return null;
    }
    
    // Log all event topics for debugging
    receipt.logs.forEach((log: any, index: number) => {
      console.log(`Log ${index} topics:`, log.topics);
      console.log(`Log ${index} address:`, log.address);
      console.log(`Log ${index} full log:`, JSON.stringify(log, null, 2));
    });
    
    // From your logs, we can see that the event has a signature topic and then the data contains the proposal ID
    // The ProposalCreated event is from the governor contract
    const governorLog = receipt.logs.find((log: any) => 
      log.address?.toLowerCase() === governorAddress.toLowerCase()
    );
    
    if (governorLog) {
      console.log('Found governor contract log:', governorLog);
      
      // For Governor contracts, the proposal ID is often the first parameter in the data field
      // The data field is a hex string that needs to be decoded
      try {
        // Extract the first 32 bytes (64 hex chars + '0x' prefix) from the data field
        // This is likely the proposal ID
        const data = governorLog.data;
        console.log('Event data:', data);
        
        if (data && data.length >= 66) {
          // The first 32 bytes after the '0x' prefix
          const proposalIdHex = '0x' + data.slice(2, 66);
          console.log('Extracted potential proposal ID hex:', proposalIdHex);
          
          // Convert to decimal for display and database consistency
          const proposalIdDecimal = BigInt(proposalIdHex).toString();
          console.log('Proposal ID in decimal:', proposalIdDecimal);
          
          // Store both formats for debugging
          localStorage.setItem('lastProposalIdHex', proposalIdHex);
          localStorage.setItem('lastProposalIdDecimal', proposalIdDecimal);
          
          // Set the proposal ID in state for navigation
          setProposalId(proposalIdDecimal);
          
          return proposalIdDecimal;
        }
      } catch (error) {
        console.error('Error extracting proposal ID from event data:', error);
      }
    }
    
    // Do NOT fabricate an ID from the tx hash: a fake proposalId never matches the
    // on-chain proposal, so the detail page, queue, and execute all break for that
    // row. Treat a missing ProposalCreated log as a hard failure instead.
    console.error('Could not extract proposalId from the ProposalCreated event logs');
    return null;
  };
  
  const saveToSupabase = async (proposalData: any) => {
    try {
      console.log('Saving proposal to Supabase:', proposalData);
      
      // Try insert
      try {
        const { data: insertData, error: insertError } = await supabase
          .from('proposals')
          .insert(proposalData)
          .select();
          
        if (insertError) {
          console.error('Error inserting proposal:', insertError);
          
          // Check specific error cases
          if (insertError.code === '42P01') { // undefined_table
            const errorMessage = 'The proposals table does not exist in your Supabase database.';
            console.error(errorMessage);
            setError(errorMessage);
            return false;
          }
          
          // Row-level security permission errors
          if (insertError.code === '42501') { // permission_denied
            const errorMessage = 'Permission denied: Your anonymous user lacks access to the proposals table.';
            console.error(errorMessage);
            setError(errorMessage);
            return false;
          }
          
          // If unique constraint violation, try update
          if (insertError.code === '23505') {
            console.log('Proposal already exists, attempting update');
            
            const { data: updateData, error: updateError } = await supabase
              .from('proposals')
              .update(proposalData)
              .eq('proposal_id', proposalData.proposal_id)
              .select();
              
            if (updateError) {
              console.error('Update also failed:', updateError);
              setError(`Failed to update proposal: ${updateError.message}`);
              return false;
            }
            
            console.log('Successfully updated proposal:', updateData);
          } else {
            const errorMessage = `Failed to save proposal: ${insertError.message}`;
            setError(errorMessage);
            return false;
          }
        } else {
          console.log('Successfully inserted proposal:', insertData);
        }
        
        // Navigate to proposal details page
        const proposalDetailsUrl = `/proposals/${proposalData.proposal_id}`;
        console.log('Navigating to:', proposalDetailsUrl);
        
        setTimeout(() => {
          navigate(proposalDetailsUrl);
        }, 1500);
        
        return true;
      } catch (innerErr) {
        console.error('Database operation error:', innerErr);
        const errorMessage = `Database error: ${innerErr instanceof Error ? innerErr.message : 'Unknown error'}`;
        setError(errorMessage);
        return false;
      }
    } catch (err) {
      console.error('Unexpected error in saveToSupabase:', err);
      const errorMessage = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMessage);
      return false;
    }
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      summary: "",
      description: "",
      fullDescription: "",
      category: "",
      votingPeriod: "",
      actions: [{ target: '', value: '0', calldata: '0x' }], // Start with one empty action by default
    }
  });

  // Initialize useFieldArray for actions
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "actions"
  });

  const getVotingPeriodInSeconds = (period: string): number => {
    const days = {
      '3days': 3,
      '5days': 5,
      '7days': 7,
      '14days': 14
    }[period] || 3;
    
    return days * 24 * 60 * 60; // Convert days to seconds
  };

  // Get the current chain configuration
  const currentChain = chainId === 3889 ? kalyChainTestnet : kalyChainMainnet;

  // Function to allow ActionBuilder to update parent form state
  const updateActionFields = (index: number, updates: { target?: string; value?: string }) => {
    if (updates.target !== undefined) {
      form.setValue(`actions.${index}.target`, updates.target);
    }
    if (updates.value !== undefined) {
      form.setValue(`actions.${index}.value`, updates.value);
    }
    // Trigger validation if needed, though zod should handle it on submit
    // form.trigger(`actions.${index}`);
  };

  const onSubmit = async (formData: FormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Build the on-chain actions. Signaling ("vote only") proposals attach a
      // single harmless DAOSettings no-op so they satisfy the Governor's
      // "at least one action" rule without the user touching targets/calldata.
      let actions: { target: `0x${string}`; value: bigint; calldata: `0x${string}` }[];

      if (proposalType === 'signaling') {
        const daoSettingsAddress = (chainId === 3889
          ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.DAO_SETTINGS
          : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.DAO_SETTINGS) as `0x${string}`;
        const signal = buildSignalingAction(daoSettingsAddress, formData.title);
        actions = [{ target: signal.target, value: BigInt(signal.value), calldata: signal.calldata }];
      } else {
        if (!formData.actions || formData.actions.length === 0) {
          throw new Error('Add at least one action, or switch to a Signaling (vote only) proposal.');
        }
        // Validate every target up front: an empty/invalid target makes `propose`
        // un-encodable and would otherwise hang the form with no wallet popup.
        const badIndex = formData.actions.findIndex(a => !isValidActionTarget(a.target));
        if (badIndex !== -1) {
          throw new Error(
            `Action ${badIndex + 1} has no valid target address. Pick an action type that sets a target, or use a Signaling (vote only) proposal.`,
          );
        }
        actions = formData.actions.map(action => ({
          target: action.target as `0x${string}`,
          value: BigInt(action.value),
          calldata: action.calldata as `0x${string}`,
        }));
      }

      const targets = actions.map(a => a.target);
      const values = actions.map(a => a.value);
      const calldatas = actions.map(a => a.calldata);

      // Record exactly what we submit so the Supabase row stores matching params.
      submittedActionsRef.current = {
        targets,
        values: values.map(v => v.toString()),
        calldatas,
      };

      // Combine description and fullDescription for on-chain storage
      const fullProposalText = `# ${formData.title}\n\n## Summary\n${formData.summary}\n\n## Description\n${formData.description}\n\n## Full Description\n${formData.fullDescription}`;

      // Create proposal with actual parameters.
      // Gas config is REQUIRED on KalyChain: without an explicit gasPrice the tx goes
      // out underpriced (below the ~1 Gwei minimum) and sits pending forever. Same
      // config the wrap/vote/delegate writes use, with a higher gas LIMIT because
      // `propose` (stores targets/calldatas + emits the full description) needs more
      // than the default 300k.
      writeContract({
        address: contracts.governor.address as `0x${string}`,
        abi: governorAbi,
        functionName: 'propose',
        args: [targets, values, calldatas, fullProposalText],
        account: address,
        chain: currentChain,
        ...getTransactionGasConfig(),
        gas: 1_500_000n,
      });
    } catch (err) {
      console.error('Failed to create proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
      setIsSubmitting(false);
      toast({
        title: 'Transaction Failed', 
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-card p-6 rounded-lg shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Create New Proposal
        </h1>
        <p className="text-muted-foreground mt-2">
          Submit a proposal for the KalyChain DAO to vote on. Proposals require
          a minimum of {minProposalThreshold.toLocaleString()} gKLC (Governance KLC) voting power
          to create.
        </p>
        {chainId && (
          <p className="text-sm text-muted-foreground mt-1">
            Network: {chainId === 3889 ? 'Testnet' : 'Mainnet'} | Your voting power: {userVotingPower.toLocaleString()} gKLC
          </p>
        )}
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">
                Wallet Not Connected
              </h3>
              <p className="text-muted-foreground mt-2 mb-4">
                You need to connect your wallet to create a proposal
              </p>
              <WalletButton />
            </div>
          </CardContent>
        </Card>
      ) : !hasEnoughVotingPower ? (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{needsDelegation ? 'Activate Your Voting Power' : 'Insufficient Voting Power'}</AlertTitle>
            <AlertDescription>
              {needsDelegation ? (
                <>You hold {tokenBalance.toLocaleString()} gKLC but your active voting
                power is {userVotingPower.toLocaleString()} — voting power only counts
                once you delegate it (even to yourself). Visit the Delegation page to
                activate it, then you can propose.</>
              ) : (
                <>You need at least {minProposalThreshold.toLocaleString()} gKLC voting
                power to create a proposal. You currently have{" "}
                {userVotingPower.toLocaleString()} gKLC.</>
              )}
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle>Need Voting Power?</CardTitle>
              <CardDescription>
                To participate in governance, you need to wrap your KLC tokens to gKLC
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                gKLC (Governance KLC) is the governance token that gives you voting power in the DAO.
                You can wrap your KLC tokens to gKLC and unwrap them back at any time.
              </p>
              <Link
                to="/wrap-klc"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Wrap KLC to gKLC
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Form {...form}>
          <form 
            onSubmit={(e) => {
              // Prevent default form submission
              e.preventDefault();
            }} 
            className="space-y-6"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Proposal Type</CardTitle>
                <CardDescription>
                  Choose whether this proposal performs an on-chain action or is a vote only
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={proposalType}
                  onValueChange={(value) => setProposalType(value as ProposalType)}
                  className="space-y-3"
                >
                  <label
                    htmlFor="ptype-signaling"
                    className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-colors ${
                      proposalType === 'signaling' ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <RadioGroupItem value="signaling" id="ptype-signaling" className="mt-1" />
                    <div>
                      <div className="font-medium">Signaling (vote only)</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        A community decision with no on-chain action — e.g. approving a direction,
                        a budget, or a change you&apos;ll apply manually. No contract address or
                        calldata needed. <span className="font-medium">Recommended for most proposals.</span>
                      </p>
                    </div>
                  </label>
                  <label
                    htmlFor="ptype-action"
                    className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-colors ${
                      proposalType === 'action' ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <RadioGroupItem value="action" id="ptype-action" className="mt-1" />
                    <div>
                      <div className="font-medium">On-chain action</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        The DAO executes a transaction if it passes — e.g. sending treasury funds
                        or changing a governance parameter. You&apos;ll configure the action below.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proposal Details</CardTitle>
                <CardDescription>
                  Provide the basic information about your proposal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Title</FormLabel>
                        <CharCount value={field.value} min={10} max={100} />
                      </div>
                      <FormControl>
                        <Input
                          placeholder="Enter a clear, concise title"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This will be displayed as the main title of your proposal
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Summary</FormLabel>
                        <CharCount value={field.value} min={20} max={250} />
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a brief summary of your proposal"
                          {...field}
                          className="resize-none"
                          rows={2}
                        />
                      </FormControl>
                      <FormDescription>
                        A short summary that will appear in proposal listings
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Description</FormLabel>
                        <CharCount value={field.value} min={100} />
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a detailed description of your proposal"
                          {...field}
                          className="resize-none"
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        A clear explanation of what this proposal aims to achieve
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullDescription"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Full Description</FormLabel>
                        <CharCount value={field.value} min={200} />
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Provide comprehensive details, technical specifications, and implementation plans"
                          {...field}
                          className="resize-vertical"
                          rows={8}
                        />
                      </FormControl>
                      <FormDescription>
                        Include all necessary details, technical specifications, implementation plans, and any relevant links or resources
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="governance">Governance</SelectItem>
                          <SelectItem value="treasury">Treasury</SelectItem>
                          <SelectItem value="protocol">Protocol</SelectItem>
                          <SelectItem value="community">Community</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The category helps organize proposals by their purpose
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Voting Configuration (set by contract):
                    </span>
                  </div>
                  <div className="bg-secondary p-4 rounded-md space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Voting Delay:</span>
                      <span>{formatBlocksToDays(votingDelay)} days ({votingDelay?.toString() || '...'} blocks)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Voting Period:</span>
                      <span>{formatBlocksToDays(votingPeriod)} days ({votingPeriod?.toString() || '...'} blocks)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      After proposal creation, there is a {formatBlocksToDays(votingDelay)} day delay before voting starts.
                      Once voting begins, it remains open for {formatBlocksToDays(votingPeriod)} days.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {proposalType === 'action' && form.watch("category") && (
              <Card>
                <CardHeader>
                  <CardTitle>{form.watch("category").charAt(0).toUpperCase() + form.watch("category").slice(1)} Actions</CardTitle>
                  <CardDescription>
                    Specify the actions for this {form.watch("category")} proposal
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Map over the fields array */}
                  {fields.map((item, index) => (
                    <div key={item.id} className="p-4 border rounded-md space-y-3 relative">
                      <h4 className="text-md font-medium mb-2">Action {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                          aria-label={`Remove Action ${index + 1}`}
                        >
                          Remove
                        </Button>
                      )}
                      <FormField
                        control={form.control}
                        name={`actions.${index}.target`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="0x... contract address"
                                {...field}
                                disabled={true} // Disabled as it's auto-populated by ActionBuilder
                              />
                            </FormControl>
                            <FormDescription>
                              Auto-populated based on action type
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`actions.${index}.value`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Value (in Wei)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="0"
                                {...field}
                                disabled={true}
                              />
                            </FormControl>
                            <FormDescription>
                              Set to 0 for most actions (auto-populated)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`actions.${index}.calldata`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Action Type & Calldata</FormLabel>
                            <FormControl>
                              <ActionBuilder
                                field={field}
                                actionIndex={index}
                                updateActionFields={updateActionFields}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                  {/* Add Action Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ target: '', value: '0', calldata: '0x' })}
                    className="mt-2"
                  >
                    + Add Action
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => navigate("/proposals")}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                disabled={isSubmitting || isPending || !hasEnoughVotingPower}
                onClick={async () => {
                  // Validate the form first
                  const valid = await form.trigger();
                  if (!valid) {
                    console.log('Form validation failed');
                    return;
                  }
                  
                  // Get form values
                  const formData = form.getValues();
                  console.log('Form data:', formData);
                  
                  // Directly call onSubmit
                  onSubmit(formData);
                }}
              >
                {isSubmitting || isPending ? "Creating Proposal..." : "Submit Proposal"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
};

export default CreateProposal;
