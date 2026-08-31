import { describe, it, expect } from 'vitest';
import { TRANSACTION_GAS_CONFIG } from './transaction';

describe('transaction gas config', () => {
	it('tips at least KalyChain’s 21 gwei floor (anything lower never mines when baseFee ≈ 0)', () => {
		expect(TRANSACTION_GAS_CONFIG.maxPriorityFeePerGas).toBeGreaterThanOrEqual(21_000_000_000n);
		expect(TRANSACTION_GAS_CONFIG.maxFeePerGas).toBeGreaterThanOrEqual(TRANSACTION_GAS_CONFIG.maxPriorityFeePerGas);
	});
});
