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
import { kalyChainMainnet, kalyChainTestnet } from './chains';
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';

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
const KLC_ICON = { url: ORIGIN + '/kalychain.png', width: 64, height: 64, format: 'png' as const };
const KLC_NATIVE = { name: 'KalyChain', symbol: 'KLC', decimals: 18 };
// Ecosystem token icons are hosted by this app under /public/tokens (copied from
// kaly-vault). thirdweb needs an ABSOLUTE URL, so prefix with the runtime origin.
const TOK_BASE = ORIGIN + '/tokens/';

export const twKalyMainnet = twDefineChain({
  id: kalyChainMainnet.id,
  name: 'KalyChain',
  rpc: kalyChainMainnet.rpcUrls.default.http[0],
  nativeCurrency: KLC_NATIVE,
  icon: KLC_ICON,
  blockExplorers: [{ name: 'KalyScan', url: 'https://kalyscan.io' }],
});

export const twKalyTestnet = twDefineChain({
  id: kalyChainTestnet.id,
  name: 'KalyChain Testnet',
  rpc: kalyChainTestnet.rpcUrls.default.http[0],
  nativeCurrency: KLC_NATIVE,
  icon: KLC_ICON,
  blockExplorers: [{ name: 'KalyScan', url: 'https://testnet.kalyscan.io' }],
});

// The DAO is multi-chain (users switch mainnet/testnet). Default the connect button
// to mainnet; both are offered.
export const twActiveChain = twKalyMainnet;
export const thirdwebChains = [twKalyMainnet, twKalyTestnet];

/**
 * Ecosystem tokens shown in the in-app wallet's "View Assets" (per chain). Native KLC
 * is shown automatically; this lists the ERC-20s with their logos. gKLC (governance)
 * leads the list; the rest mirror kaly-vault so the boss sees the same tokens/icons.
 */
export const SUPPORTED_TOKENS: Record<
  number,
  { address: string; name: string; symbol: string; icon: string }[]
> = {
  [kalyChainMainnet.id]: [
    { address: CONTRACT_ADDRESSES_BY_NETWORK.mainnet.GOVERNANCE_TOKEN, name: 'Governance Kaly Coin', symbol: 'gKLC', icon: TOK_BASE + 'klc.png' },
    { address: '0x069255299Bb729399f3CECaBdc73d15d3D10a2A3', name: 'Wrapped KalyCoin', symbol: 'wKLC', icon: TOK_BASE + 'klc.png' },
    { address: '0xCC93b84cEed74Dc28c746b7697d6fA477ffFf65a', name: 'KalySwap Token', symbol: 'KSWAP', icon: TOK_BASE + 'kswap.png' },
    { address: '0xCd02480926317748e95c5bBBbb7D1070b2327f1A', name: 'KUSD Stablecoin', symbol: 'KUSD', icon: TOK_BASE + 'kusd.png' },
    { address: '0x2CA775C77B922A51FcF3097F52bFFdbc0250D99A', name: 'Tether USD', symbol: 'USDT', icon: TOK_BASE + 'usdt.png' },
    { address: '0x9cAb0c396cF0F4325913f2269a0b72BD4d46E3A9', name: 'USD Coin', symbol: 'USDC', icon: TOK_BASE + 'usdc.png' },
    { address: '0x6E92CAC380F7A7B86f4163fad0df2F277B16Edc6', name: 'DAI Token', symbol: 'DAI', icon: TOK_BASE + 'dai.png' },
    { address: '0xaA77D4a26d432B82DB07F8a47B7f7F623fd92455', name: 'Wrapped BTC', symbol: 'WBTC', icon: TOK_BASE + 'wbtc.png' },
    { address: '0xfdbB253753dDE60b11211B169dC872AaE672879b', name: 'Ether', symbol: 'ETH', icon: TOK_BASE + 'eth.png' },
    { address: '0x0e2318b62a096AC68ad2D7F37592CBf0cA9c4Ddb', name: 'Binance', symbol: 'BNB', icon: TOK_BASE + 'bnb.png' },
    { address: '0x706C9a63d7c8b7Aaf85DDCca52654645f470E8Ac', name: 'Polygon', symbol: 'POL', icon: TOK_BASE + 'pol.png' },
    { address: '0xdbba43d094bc683f7420d4b5a44cd9d6bf4f1773', name: 'KNETWORK', symbol: 'KNT', icon: TOK_BASE + 'knt.png' },
  ],
  [kalyChainTestnet.id]: [
    { address: CONTRACT_ADDRESSES_BY_NETWORK.testnet.GOVERNANCE_TOKEN, name: 'Governance Kaly Coin', symbol: 'gKLC', icon: TOK_BASE + 'klc.png' },
    { address: '0xd15F19c457AaaCB7A389B305Dac8611Cd2294c36', name: 'KUSD Stablecoin', symbol: 'KUSD', icon: TOK_BASE + 'kusd.png' },
    { address: '0x6Fdb0fEd277b878a0d80494b06EA054C99d2fdD2', name: 'Tether USD', symbol: 'USDT', icon: TOK_BASE + 'usdt.png' },
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
