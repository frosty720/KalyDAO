import { describe, it, expect } from 'vitest';
import { kalychain, KALYCHAIN_CHAIN_ID, RPC_URL, EXPLORER_URL, EXPLORER_API_URL, GOV_SYMBOL, GOVERNANCE_PARAMS, blocksToDuration, explorerTx } from './chains';

describe('chains', () => {
	it('is ONE chain: KalyChain 3890, native KMT, governance gKMT', () => {
		expect(KALYCHAIN_CHAIN_ID).toBe(3890);
		expect(kalychain.id).toBe(3890);
		expect(kalychain.nativeCurrency.symbol).toBe('KMT');
		expect(GOV_SYMBOL).toBe('gKMT');
	});
	it('RPC / explorer flow from the env-backed constants (cut-day switch is env-only)', () => {
		expect(kalychain.rpcUrls.default.http[0]).toBe(RPC_URL);
		expect(kalychain.blockExplorers?.default.url).toBe(EXPLORER_URL);
		expect(EXPLORER_API_URL).toBe(`${EXPLORER_URL}/api`);
		expect(explorerTx('0xabc')).toBe(`${EXPLORER_URL}/tx/0xabc`);
		expect(RPC_URL).toMatch(/^https:\/\/[a-z0-9.-]*kalychain\.io\/rpc$/);
	});
	it('governance timing matches the deployed Governor (1 day delay, 3 days voting, 1 h timelock)', () => {
		expect(GOVERNANCE_PARAMS).toMatchObject({ votingDelayBlocks: 43_200, votingPeriodBlocks: 129_600, timelockMinDelaySec: 3_600 });
		expect(blocksToDuration(GOVERNANCE_PARAMS.votingDelayBlocks)).toBe('1 day');
		expect(blocksToDuration(GOVERNANCE_PARAMS.votingPeriodBlocks)).toBe('3 days');
		expect(blocksToDuration(1800)).toBe('1 hour');
	});
});
