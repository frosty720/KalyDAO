import type { Chain } from 'viem';

export const kalyChainMainnet = {
  id: 3888,
  name: 'KalyChain',
  nativeCurrency: {
    name: 'KalyChain',
    symbol: 'KLC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.kalychain.io/rpc'] }, 
  },
  blockExplorers: {
    default: { name: 'KalyScan', url: 'https://kalyscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0x5eBC58E77eC42F8dc381f74cf617ed872B096d5A',
      blockCreated: 16674114,
    },
  },
} as const satisfies Chain;

export const kalyChainTestnet = {
  id: 3889, 
  name: 'KalyChain Testnet',
  nativeCurrency: {
    name: 'KalyChain',
    symbol: 'KLC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://testnetrpc.kalychain.io/rpc'] }, 
  },
  blockExplorers: {
    default: { name: 'KalyScan Testnet', url: 'https://testnet.kalyscan.io' }, 
  },
  contracts: {
    multicall3: {
      address: '0x8e8f9eb71D381334197aA3dF70a6bAE81e19E1C7', 
      blockCreated: 28772421, 
    },
  },
  testnet: true,
} as const satisfies Chain; 