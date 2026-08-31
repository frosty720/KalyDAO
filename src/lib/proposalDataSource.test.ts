import { describe, it, expect } from 'vitest';
import { resolveProposalDataSource } from './proposalDataSource';

describe('resolveProposalDataSource', () => {
	it('testnet (no subgraph): always on-chain, never flagged unavailable', () => {
		const r = resolveProposalDataSource({
			hasDaoSubgraph: false,
			subgraphResponded: false,
			hasSubgraphDetail: false,
		});
		expect(r).toEqual({ useOnChainReads: true, subgraphUnavailable: false });
	});

	it('mainnet, subgraph not yet responded: wait (no on-chain, not flagged) — avoids RPC on first paint', () => {
		const r = resolveProposalDataSource({
			hasDaoSubgraph: true,
			subgraphResponded: false,
			hasSubgraphDetail: false,
		});
		expect(r).toEqual({ useOnChainReads: false, subgraphUnavailable: false });
	});

	it('mainnet, subgraph healthy (detail present): use subgraph, no on-chain', () => {
		const r = resolveProposalDataSource({
			hasDaoSubgraph: true,
			subgraphResponded: true,
			hasSubgraphDetail: true,
		});
		expect(r).toEqual({ useOnChainReads: false, subgraphUnavailable: false });
	});

	it('H1 regression — mainnet subgraph down (responded, no detail): fall back to on-chain AND flag it', () => {
		const r = resolveProposalDataSource({
			hasDaoSubgraph: true,
			subgraphResponded: true,
			hasSubgraphDetail: false,
		});
		expect(r).toEqual({ useOnChainReads: true, subgraphUnavailable: true });
	});

	it('recovery — subgraph comes back after an outage: returns to the fast path', () => {
		const down = resolveProposalDataSource({
			hasDaoSubgraph: true,
			subgraphResponded: true,
			hasSubgraphDetail: false,
		});
		const back = resolveProposalDataSource({
			hasDaoSubgraph: true,
			subgraphResponded: true,
			hasSubgraphDetail: true,
		});
		expect(down.useOnChainReads).toBe(true);
		expect(back.useOnChainReads).toBe(false);
		expect(back.subgraphUnavailable).toBe(false);
	});
});
