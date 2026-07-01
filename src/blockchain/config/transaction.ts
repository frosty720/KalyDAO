// Gas settings for transactions on KalyChain.
//
// KalyChain (Besu) reports baseFee ~7 wei and eth_maxPriorityFeePerGas = 0, so any wallet
// that ESTIMATES fees — or that is handed a legacy `gasPrice` hint (which the thirdweb
// in-app wallet DROPS on this EIP-1559 chain) — ends up underpriced and the transaction
// sits PENDING forever. We therefore pin EXPLICIT EIP-1559 fees, matching the exact values
// KalySwap and kaly-vault already use on this same chain with the same in-app wallet
// (30 gwei / 3 gwei). See kaly-vault/src/lib/chain/writes.ts.
export const TRANSACTION_GAS_CONFIG = {
  gas: 300000n, // per-write default; heavier calls (e.g. propose) override this
  maxFeePerGas: 30_000_000_000n, // 30 gwei
  maxPriorityFeePerGas: 3_000_000_000n, // 3 gwei
} as const;

// Helper function to get gas settings for contract interactions
export const getTransactionGasConfig = () => {
  return TRANSACTION_GAS_CONFIG;
};

// Helper function to get gas settings with optional overrides
export const getTransactionGasConfigWithOverrides = (overrides?: Partial<typeof TRANSACTION_GAS_CONFIG>) => {
  return {
    ...TRANSACTION_GAS_CONFIG,
    ...overrides,
  };
}; 