// Gas settings for transactions on KalyChain.
//
// KalyChain (Besu) reports baseFee ~7 wei and eth_maxPriorityFeePerGas = 0, so any wallet
// that ESTIMATES fees — or that is handed a legacy `gasPrice` hint (which the thirdweb
// in-app wallet DROPS on this EIP-1559 chain) — ends up underpriced and the transaction
// sits PENDING forever. We therefore pin EXPLICIT EIP-1559 fees. The tip is the FULL
// 21 gwei network minimum, not a token 3 gwei: with baseFee ~0 the tip IS the effective
// gas price, and anything under 21 gwei is never mined (kaly-vault hit exactly this on
// 2026-08-17). Mirrors kaly-vault/src/lib/chain/writes.ts.
export const TRANSACTION_GAS_CONFIG = {
  gas: 300000n, // per-write default; heavier calls (propose/queue/execute) override this
  maxFeePerGas: 30_000_000_000n, // 30 gwei
  maxPriorityFeePerGas: 21_000_000_000n, // 21 gwei — KalyChain's min-gas-price floor
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
