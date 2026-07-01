import { http } from 'viem';
import { createConfig } from 'wagmi';
import { kalyChainMainnet, kalyChainTestnet } from './chains';

// Global polling interval in milliseconds
const GLOBAL_POLLING_INTERVAL = 2000; // 2 seconds

// Wallet connection is driven by thirdweb's ConnectButton; the bridge
// (thirdwebBridge.ts) registers the connected wallet as a wagmi connector at
// runtime, so we keep this config connector-less and let every contract hook
// flow through it. Both KalyChain networks are configured so the app can read
// either chain regardless of which one the wallet is on.
export const wagmiConfig = createConfig({
  chains: [kalyChainMainnet, kalyChainTestnet],
  transports: {
    [kalyChainMainnet.id]: http(),
    [kalyChainTestnet.id]: http(),
  },
});

// Export the polling interval for use in other parts of the app if needed
export const POLLING_INTERVAL = GLOBAL_POLLING_INTERVAL;
