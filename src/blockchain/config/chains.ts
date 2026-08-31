import type { Chain } from 'viem';

/**
 * KalyChain after the KMT relaunch: ONE chain, id 3890, native token KMT, governance
 * token gKMT. The old mainnet/testnet fleets are gone — there is no network switch any more.
 *
 * Hostnames still say "testnet" until DNS cuts over. CUT DAY: set VITE_RPC_URL and
 * VITE_EXPLORER_URL and rebuild — nothing else in the app hardcodes a KalyChain host.
 * Addresses live in ../contracts/addresses.ts; both mirror
 * kalychain-ops/files/kmt-3890/addresses.json.
 */
export const KALYCHAIN_CHAIN_ID = 3890;
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://testnetrpc.kalychain.io/rpc';
export const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || 'https://testnet.kalyscan.io';
export const EXPLORER_API_URL = `${EXPLORER_URL}/api`;

export const NATIVE_SYMBOL = 'KMT';
export const GOV_SYMBOL = 'gKMT';
export const GOV_NAME = 'Governance KMT';

/** On-chain Governor/Timelock parameters (verified on 3890; the subgraph reports the same). */
export const GOVERNANCE_PARAMS = {
  votingDelayBlocks: 43_200, // ~1 day at 2 s blocks
  votingPeriodBlocks: 129_600, // ~3 days
  timelockMinDelaySec: 3_600,
  blockTimeSec: 2,
} as const;

export const kalychain = {
  id: KALYCHAIN_CHAIN_ID,
  name: 'KalyChain',
  nativeCurrency: { name: 'KalyChain Monetary Token', symbol: NATIVE_SYMBOL, decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'KalyScan', url: EXPLORER_URL } },
  contracts: {
    multicall3: { address: '0xaee3b717fb33d9fddb4fbd0a6906bc34da5a67ab' },
  },
} as const satisfies Chain;

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;

/** Blocks → human duration using the chain's 2 s block time (for governance copy). */
export function blocksToDuration(blocks: number): string {
  const seconds = blocks * GOVERNANCE_PARAMS.blockTimeSec;
  const days = seconds / 86_400;
  if (days >= 1) return `${Math.round(days * 10) / 10} day${days >= 1.95 ? 's' : ''}`;
  const hours = seconds / 3_600;
  return `${Math.round(hours * 10) / 10} hour${hours >= 1.95 ? 's' : ''}`;
}
