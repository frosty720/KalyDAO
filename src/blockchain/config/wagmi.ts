import { http } from 'viem';
import { createConfig } from 'wagmi';
import { kalychain } from './chains';

// Global polling interval in milliseconds
const GLOBAL_POLLING_INTERVAL = 2000; // 2 seconds

// Wallet connection is driven by thirdweb's ConnectButton; the bridge
// (thirdwebBridge.ts) registers the connected wallet as a wagmi connector at
// runtime, so we keep this config connector-less and let every contract hook
// flow through it. ONE chain: KalyChain 3890.
export const wagmiConfig = createConfig({
  chains: [kalychain],
  transports: {
    [kalychain.id]: http(kalychain.rpcUrls.default.http[0]),
  },
});

// Export the polling interval for use in other parts of the app if needed
export const POLLING_INTERVAL = GLOBAL_POLLING_INTERVAL;
