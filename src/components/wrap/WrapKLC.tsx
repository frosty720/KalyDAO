import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { kalyChainTestnet } from '@/blockchain/config/chains';
import { getTransactionGasConfig } from '@/blockchain/config/transaction';
import { useBlockWatcher } from '../BlockWatcher';
import { toast } from '@/components/ui/use-toast';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Normalize a user-entered amount (allows comma decimals) to wei. */
const toWei = (amount: string): bigint => parseEther(amount.replace(',', '.'));

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const governanceTokenABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
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
  }
] as const;

const WrapKLC = () => {
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAction, setLastAction] = useState<'deposit' | 'withdraw' | 'delegate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Get the correct token address based on current network
  const isTestnet = chainId === kalyChainTestnet.id;
  const governanceTokenAddress = isTestnet
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN;

  // Get native KLC balance
  const { data: klcBalance, refetch: refetchKLCBalance } = useBalance({
    address,
  });

  // Get gKLC balance
  const { data: gklcBalance, refetch: refetchGKLCBalance } = useBalance({
    address,
    token: governanceTokenAddress,
  });

  // ERC20Votes voting power is 0 until the holder delegates (even to themselves).
  const { data: currentDelegate, refetch: refetchDelegate } = useReadContract({
    address: governanceTokenAddress as `0x${string}`,
    abi: governanceTokenABI,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isDelegated =
    !!currentDelegate &&
    currentDelegate !== ZERO_ADDRESS &&
    currentDelegate.toLowerCase() === address?.toLowerCase();
  const hasGklc = !!gklcBalance?.value && gklcBalance.value > 0n;

  // Set up block watcher to refresh balances and delegation status
  useBlockWatcher(() => {
    refetchKLCBalance();
    refetchGKLCBalance();
    refetchDelegate();
  });

  const { writeContractAsync, data: hash } = useWriteContract();
  // Pin the receipt watcher to the same chain the wrap/unwrap writes target.
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, chainId });

  // "Processing" must stay true through mining, not just submission.
  const isProcessing = isSubmitting || isConfirming;

  // React to a confirmed (mined) transaction: refresh, toast, clear input.
  useEffect(() => {
    if (!isConfirmed || !hash) return;
    refetchKLCBalance();
    refetchGKLCBalance();
    refetchDelegate();
    setAmount('');
    if (lastAction === 'deposit') {
      toast({ title: 'KLC wrapped', description: 'Your gKLC balance has been updated.' });
    } else if (lastAction === 'withdraw') {
      toast({ title: 'gKLC unwrapped', description: 'Your KLC balance has been updated.' });
    } else if (lastAction === 'delegate') {
      toast({ title: 'Voting power activated', description: 'You can now vote and create proposals.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, hash]);

  const handleWrap = async () => {
    if (!amount || !address) return;
    setError(null);
    setLastAction('deposit');
    setIsSubmitting(true);
    try {
      // @ts-ignore wagmi v2 generics reject the spread gas-config fields; params are valid at runtime. Gas handling is revisited in the web3-hardening task.
      await writeContractAsync({
        address: governanceTokenAddress as `0x${string}`,
        abi: governanceTokenABI,
        functionName: 'deposit',
        value: toWei(amount),
        args: [],
        ...getTransactionGasConfig(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deposit KLC. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnwrap = async () => {
    if (!amount || !address) return;
    setError(null);
    setLastAction('withdraw');
    setIsSubmitting(true);
    try {
      // @ts-ignore wagmi v2 generics reject the spread gas-config fields; params are valid at runtime. Gas handling is revisited in the web3-hardening task.
      await writeContractAsync({
        address: governanceTokenAddress as `0x${string}`,
        abi: governanceTokenABI,
        functionName: 'withdraw',
        args: [toWei(amount)],
        ...getTransactionGasConfig(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw gKLC. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelfDelegate = async () => {
    if (!address) return;
    setError(null);
    setLastAction('delegate');
    setIsSubmitting(true);
    try {
      // @ts-ignore wagmi v2 generics reject the spread gas-config fields; params are valid at runtime. Gas handling is revisited in the web3-hardening task.
      await writeContractAsync({
        address: governanceTokenAddress as `0x${string}`,
        abi: governanceTokenABI,
        functionName: 'delegate',
        args: [address],
        ...getTransactionGasConfig(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delegate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to handle max button click
  const handleMaxClick = () => {
    if (activeTab === 'deposit') {
      // For deposits, use the KLC balance minus a small gas buffer. Guard against
      // underflow when the balance is below the buffer (would go negative).
      const gasBuffer = parseEther('0.01');
      const spendable = klcBalance?.value && klcBalance.value > gasBuffer
        ? klcBalance.value - gasBuffer
        : 0n;
      setAmount(formatEther(spendable));
    } else {
      // For withdraws, use the entire gKLC balance
      const maxAmount = gklcBalance?.value ? 
        formatEther(gklcBalance.value) : '0';
      setAmount(maxAmount);
    }
  };

  if (!isConnected) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">
                Wallet Not Connected
              </h3>
              <p className="text-muted-foreground mt-2 mb-4">
                Connect your wallet to wrap or unwrap KLC
              </p>
              <WalletButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const numericAmount = Number(amount.replace(',', '.'));

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Wrap/Unwrap KLC</CardTitle>
          <CardDescription>
            Deposit KLC to get gKLC for governance participation, or withdraw your gKLC back to KLC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {hasGklc && !isDelegated && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Activate your voting power</AlertTitle>
                <AlertDescription>
                  You hold {gklcBalance?.formatted} gKLC but have{' '}
                  <span className="font-medium">0 voting power</span> until you delegate. Delegate
                  to yourself once to vote and create proposals.
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" onClick={handleSelfDelegate} disabled={isProcessing}>
                      {isProcessing && lastAction === 'delegate' ? 'Delegating…' : 'Delegate to myself'}
                    </Button>
                    <Link to="/delegation">
                      <Button size="sm" variant="outline">
                        More delegation options
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Available KLC: {klcBalance?.formatted || '0'}</span>
                <span>Available gKLC: {gklcBalance?.formatted || '0'}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Network: {isTestnet ? 'Testnet' : 'Mainnet'}
              </div>
            </div>

            <Tabs defaultValue="deposit" onValueChange={(value) => setActiveTab(value as "deposit" | "withdraw")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="deposit">Deposit</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              </TabsList>

              <TabsContent value="deposit" className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      pattern="^[0-9]*[.,]?[0-9]*$"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => {
                        // Only allow numbers and decimals
                        if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value)) {
                          setAmount(e.target.value);
                        }
                      }}
                      className="pr-16" // Add padding for the max button
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                      onClick={handleMaxClick}
                    >
                      MAX
                    </Button>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleWrap}
                    disabled={isProcessing || !amount || numericAmount <= 0 || numericAmount > Number(klcBalance?.formatted || 0)}
                  >
                    {isProcessing ? "Processing..." : "Deposit KLC"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Deposit your KLC to get gKLC at a 1:1 ratio. You can withdraw back to KLC at any time.
                </p>
              </TabsContent>

              <TabsContent value="withdraw" className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      pattern="^[0-9]*[.,]?[0-9]*$"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => {
                        // Only allow numbers and decimals
                        if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value)) {
                          setAmount(e.target.value);
                        }
                      }}
                      className="pr-16" // Add padding for the max button
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                      onClick={handleMaxClick}
                    >
                      MAX
                    </Button>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleUnwrap}
                    disabled={isProcessing || !amount || numericAmount <= 0 || numericAmount > Number(gklcBalance?.formatted || 0)}
                  >
                    {isProcessing ? "Processing..." : "Withdraw gKLC"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Withdraw your gKLC back to KLC at any time. Note that you need gKLC to participate in governance.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WrapKLC; 