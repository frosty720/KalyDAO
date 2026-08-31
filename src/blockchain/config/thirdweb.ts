/**
 * Thirdweb SDK configuration — ported from kaly-vault / KalySwap so users share ONE
 * in-app wallet across all KalyChain apps. The in-app wallet address is derived from
 * the login identity (email/social/passkey) under a given client id, so using the
 * SAME client id as KalySwap/kaly-vault means the same email logs into the same
 * wallet on every site.
 *
 * Wagmi still drives every contract read/write — see thirdwebBridge.ts, which wraps
 * the connected thirdweb wallet as a wagmi connector.
 */

import { createThirdwebClient, defineChain as twDefineChain } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { kalychain, EXPLORER_URL, GOV_NAME, GOV_SYMBOL } from './chains';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

// createThirdwebClient throws on an empty clientId. Fall back to a placeholder so the
// module never crashes; injected wallets (MetaMask) still work, but the in-app
// (email/social) wallet REQUIRES the real key (reuse KalySwap's — same shared wallet).
const CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID || 'MISSING_THIRDWEB_CLIENT_ID';

if (CLIENT_ID === 'MISSING_THIRDWEB_CLIENT_ID' && typeof window !== 'undefined') {
  console.warn(
    '[KalyDAO] VITE_THIRDWEB_CLIENT_ID is not set. Injected wallets (MetaMask) work, but the ' +
      'email/social in-app wallet is disabled until you add the key (reuse KalySwap’s).',
  );
}

export const thirdwebClient = createThirdwebClient({ clientId: CLIENT_ID });

// Absolute icon URL (thirdweb won't resolve a relative path). Icons only render
// client-side, where window.location.origin is the live host.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const NATIVE_ICON = { url: ORIGIN + '/kalychain.png', width: 64, height: 64, format: 'png' as const };
const NATIVE_CURRENCY = { name: 'KalyChain Monetary Token', symbol: 'KMT', decimals: 18 };
// Ecosystem token icons are hosted by this app under /public/tokens (copied from
// kaly-vault). thirdweb needs an ABSOLUTE URL, so prefix with the runtime origin.
const TOK_BASE = ORIGIN + '/tokens/';

export const twKalychain = twDefineChain({
  id: kalychain.id,
  name: kalychain.name,
  rpc: kalychain.rpcUrls.default.http[0],
  nativeCurrency: NATIVE_CURRENCY,
  icon: NATIVE_ICON,
  blockExplorers: [{ name: 'KalyScan', url: EXPLORER_URL }],
});

// ONE chain — the connect button and the bridge both use it.
export const twActiveChain = twKalychain;
export const thirdwebChains = [twActiveChain];

/**
 * Ecosystem tokens shown in the in-app wallet's "View Assets". Native KMT is shown
 * automatically; gKMT (governance) leads the list, the rest are the 3890 tokens from
 * kalychain-ops/files/kmt-3890/addresses.json (same set/icons as kaly-vault).
 */
export const SUPPORTED_TOKENS: Record<
  number,
  { address: string; name: string; symbol: string; icon: string }[]
> = {
  [kalychain.id]: [
    { address: CONTRACT_ADDRESSES.GOVERNANCE_TOKEN, name: GOV_NAME, symbol: GOV_SYMBOL, icon: TOK_BASE + 'klc.png' },
    { address: '0xf90F0Bd56558Ac12F7FC285571D38181d2feD69b', name: 'Wrapped KMT', symbol: 'WKMT', icon: TOK_BASE + 'klc.png' },
    { address: '0x6318EcDbae6B469D39C38949eDC671f4bA8A6172', name: 'Tether USD', symbol: 'USDT', icon: TOK_BASE + 'usdt.png' },
    { address: '0xf00A4b733093C21b0892eae0578F0a926f9370b3', name: 'USD Coin', symbol: 'USDC', icon: TOK_BASE + 'usdc.png' },
    { address: '0x8fbff791fCcF596DEf2e788549d0275557F95A21', name: 'DAI Token', symbol: 'DAI', icon: TOK_BASE + 'dai.png' },
    { address: '0xE3f1A8Af16d2Dcd0B6F1F813C449375f85C9d97F', name: 'Wrapped BTC', symbol: 'WBTC', icon: TOK_BASE + 'wbtc.png' },
    { address: '0x73b8fBACFF08DafD9a0a6cB8699C64a488d9EA2a', name: 'Ether', symbol: 'ETH', icon: TOK_BASE + 'eth.png' },
    { address: '0xFDb3307a16442ed5A7C040AE1600a3B3D3C8e7D9', name: 'KUSD Stablecoin', symbol: 'KUSD', icon: TOK_BASE + 'kusd.png' },
  ],
};

/** In-app wallet: email / social / passkey login. Same auth set as KalySwap/kaly-vault. */
export const daoInAppWallet = inAppWallet({
  auth: {
    options: ['email', 'google', 'apple', 'passkey', 'phone'],
    mode: 'popup',
  },
});

/** External wallets, surfaced after the in-app option. */
export const externalWallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('io.rabby'),
];

/** In-app wallet first (shared-login path), then external, then WalletConnect. */
export const allWallets = [daoInAppWallet, ...externalWallets, createWallet('walletConnect')];
