/**
 * Thirdweb → Wagmi bridge (ported from kaly-vault / KalySwap).
 *
 * When a user connects through thirdweb's ConnectButton (in-app wallet OR an
 * external wallet), wagmi doesn't know about it. This hook watches thirdweb's
 * active wallet and registers a wagmi connector built from its EIP-1193 provider,
 * so every existing wagmi hook (useAccount, useReadContract, useWriteContract,
 * useWaitForTransactionReceipt) keeps working unchanged.
 *
 * Adapted for the DAO's two chains (mainnet 3888 / testnet 3889). Keeps the
 * self-heal (re-sync if wagmi drops while thirdweb stays connected) and the
 * exponential-backoff retry.
 */

import { useEffect, useRef } from 'react';
import { useActiveWallet, useActiveAccount, useActiveWalletChain } from 'thirdweb/react';
import { useConnect, useDisconnect, useAccount, createConnector } from 'wagmi';
import { EIP1193 } from 'thirdweb/wallets';
import type { EIP1193Provider, Chain as ViemChain } from 'viem';
import type { Chain as ThirdwebChain } from 'thirdweb';
import { thirdwebClient, twActiveChain, twKalyMainnet, twKalyTestnet } from './thirdweb';
import { kalyChainMainnet, kalyChainTestnet } from './chains';

const WAGMI_CHAINS = {
  [kalyChainMainnet.id]: kalyChainMainnet,
  [kalyChainTestnet.id]: kalyChainTestnet,
} as const;

const TW_CHAINS = {
  [kalyChainMainnet.id]: twKalyMainnet,
  [kalyChainTestnet.id]: twKalyTestnet,
} as const;

function wagmiChainFor(chainId: number): ViemChain {
  return (WAGMI_CHAINS as Record<number, ViemChain>)[chainId] ?? kalyChainMainnet;
}
function twChainFor(chainId: number | undefined): ThirdwebChain {
  return (chainId && (TW_CHAINS as Record<number, ThirdwebChain>)[chainId]) || twActiveChain;
}

function createThirdwebWagmiConnector(getProvider: () => EIP1193Provider) {
  return createConnector(() => ({
    id: 'thirdweb-inapp',
    name: 'Kaly Wallet',
    type: 'thirdweb',

    async connect(_params?: unknown) {
      const provider = getProvider();
      const accounts = (await provider.request({ method: 'eth_accounts', params: [] })) as string[];
      const chainIdHex = (await provider.request({ method: 'eth_chainId', params: [] })) as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { accounts: accounts as `0x${string}`[], chainId: parseInt(chainIdHex, 16) } as any;
    },
    async disconnect() {},
    async getAccounts() {
      const accounts = (await getProvider().request({ method: 'eth_accounts', params: [] })) as string[];
      return accounts as `0x${string}`[];
    },
    async getChainId() {
      const chainIdHex = (await getProvider().request({ method: 'eth_chainId', params: [] })) as string;
      return parseInt(chainIdHex, 16);
    },
    async getProvider() {
      return getProvider();
    },
    async isAuthorized() {
      const accounts = (await getProvider().request({ method: 'eth_accounts', params: [] })) as string[];
      return accounts.length > 0;
    },
    async switchChain({ chainId }: { chainId: number }) {
      await getProvider().request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      return wagmiChainFor(chainId);
    },
    onAccountsChanged() {},
    onChainChanged() {},
    onConnect() {},
    onDisconnect() {},
    onMessage() {},
  }));
}

export function useThirdwebWagmiBridge() {
  const thirdwebWallet = useActiveWallet();
  const thirdwebAccount = useActiveAccount();
  const thirdwebChain = useActiveWalletChain();
  const { connect } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { address: wagmiAddress, isConnected: wagmiConnected, connector: wagmiConnector } = useAccount();

  const lastSyncedAddress = useRef<string | null>(null);
  const lastSyncedChainId = useRef<number | null>(null);
  const isSyncing = useRef(false);
  const providerRef = useRef<EIP1193Provider | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);

  function updateProvider(
    wallet: Parameters<typeof EIP1193.toProvider>[0]['wallet'],
    chain: ThirdwebChain,
  ) {
    providerRef.current = EIP1193.toProvider({ wallet, chain, client: thirdwebClient }) as EIP1193Provider;
  }

  useEffect(() => {
    if (isSyncing.current) return;

    // Case 1: thirdweb wallet connected — sync into wagmi.
    if (thirdwebWallet && thirdwebAccount?.address) {
      const twAddress = thirdwebAccount.address.toLowerCase();
      const twChainId = thirdwebChain?.id || twActiveChain.id;

      const addressChanged = lastSyncedAddress.current !== twAddress;
      const chainChanged = lastSyncedChainId.current !== null && lastSyncedChainId.current !== twChainId;
      const wagmiDesynced = lastSyncedAddress.current !== null && !wagmiConnected;

      if (!addressChanged && !chainChanged && !wagmiDesynced) return;

      if (wagmiDesynced) {
        lastSyncedAddress.current = null;
        lastSyncedChainId.current = null;
      }

      // Wagmi already has this address via a direct (non-bridge) connector.
      if (
        wagmiConnected &&
        wagmiAddress?.toLowerCase() === twAddress &&
        !chainChanged &&
        wagmiConnector?.id !== 'thirdweb-inapp'
      ) {
        lastSyncedAddress.current = twAddress;
        lastSyncedChainId.current = twChainId;
        return;
      }

      isSyncing.current = true;
      updateProvider(thirdwebWallet, twChainFor(twChainId));
      const connector = createThirdwebWagmiConnector(() => providerRef.current!);

      const attemptConnect = () => {
        connect(
          { connector },
          {
            onSuccess: () => {
              lastSyncedAddress.current = twAddress;
              lastSyncedChainId.current = twChainId;
              isSyncing.current = false;
              retryAttemptRef.current = 0;
              if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
              }
            },
            onError: () => {
              isSyncing.current = false;
              const attempt = retryAttemptRef.current;
              if (attempt < 5) {
                const delay = 1000 * Math.pow(2, attempt);
                retryAttemptRef.current = attempt + 1;
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(() => {
                  if (
                    thirdwebWallet &&
                    thirdwebAccount?.address?.toLowerCase() === twAddress &&
                    lastSyncedAddress.current !== twAddress &&
                    !isSyncing.current
                  ) {
                    isSyncing.current = true;
                    updateProvider(thirdwebWallet, twChainFor(twChainId));
                    attemptConnect();
                  }
                }, delay);
              } else {
                retryAttemptRef.current = 0;
              }
            },
          },
        );
      };
      attemptConnect();
    }

    // Case 2: thirdweb disconnected — unsync wagmi if it was the bridge connector.
    if (!thirdwebAccount && lastSyncedAddress.current) {
      if (wagmiConnected && wagmiConnector?.id === 'thirdweb-inapp') {
        wagmiDisconnect();
        lastSyncedAddress.current = null;
        lastSyncedChainId.current = null;
        providerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
        retryAttemptRef.current = 0;
      }
    }
  }, [
    thirdwebWallet,
    thirdwebAccount?.address,
    thirdwebChain?.id,
    wagmiAddress,
    wagmiConnected,
    wagmiConnector?.id,
    connect,
    wagmiDisconnect,
  ]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);
}
