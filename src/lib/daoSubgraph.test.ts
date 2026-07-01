import { describe, it, expect } from 'vitest';
import {
	parseProposalTotals,
	voteId,
	getDaoSubgraphUrl,
	queryProposalTotals,
	parseVoteHistory,
	deriveProposalState,
	parseProposalDetail,
	type SubgraphProposalNode,
	type SubgraphVoteNode,
	type SubgraphProposalDetailNode,
} from './daoSubgraph';

// OZ Governor state enum indices, matching the UI's `states` array:
// 0 Pending, 1 Active, 2 Canceled, 3 Defeated, 4 Succeeded, 5 Queued, 6 Expired, 7 Executed
const PENDING = 0, ACTIVE = 1, CANCELED = 2, DEFEATED = 3, SUCCEEDED = 4, QUEUED = 5, EXECUTED = 7;

function detail(overrides: Partial<SubgraphProposalDetailNode> = {}): SubgraphProposalDetailNode {
	return {
		id: '1',
		proposalId: '1',
		proposer: '0x0000000000000000000000000000000000000001',
		voteStart: '100',
		voteEnd: '200',
		forVotes: '0',
		againstVotes: '0',
		abstainVotes: '0',
		quorumVotes: '0',
		status: 'Created',
		eta: null,
		...overrides,
	};
}

describe('deriveProposalState', () => {
	it('returns Executed/Canceled/Queued straight from the lifecycle status', () => {
		expect(deriveProposalState(parseProposalDetail(detail({ status: 'Executed' })), 999n)).toBe(EXECUTED);
		expect(deriveProposalState(parseProposalDetail(detail({ status: 'Canceled' })), 999n)).toBe(CANCELED);
		expect(deriveProposalState(parseProposalDetail(detail({ status: 'Queued' })), 999n)).toBe(QUEUED);
	});

	it('is Pending before voteStart', () => {
		expect(deriveProposalState(parseProposalDetail(detail({ voteStart: '100', voteEnd: '200' })), 50n)).toBe(PENDING);
	});

	it('is Active between voteStart and voteEnd', () => {
		expect(deriveProposalState(parseProposalDetail(detail({ voteStart: '100', voteEnd: '200' })), 150n)).toBe(ACTIVE);
	});

	it('is Succeeded after voteEnd when quorum reached and for > against', () => {
		const p = parseProposalDetail(
			detail({ voteEnd: '200', forVotes: '3000', againstVotes: '10', abstainVotes: '0', quorumVotes: '2000' }),
		);
		expect(deriveProposalState(p, 250n)).toBe(SUCCEEDED);
	});

	it('is Defeated after voteEnd when quorum NOT reached (KIP001: 1.6M for < 2.148M quorum)', () => {
		const p = parseProposalDetail(
			detail({ voteEnd: '200', forVotes: '1600', againstVotes: '0', abstainVotes: '0', quorumVotes: '2148' }),
		);
		expect(deriveProposalState(p, 250n)).toBe(DEFEATED);
	});

	it('is Defeated after voteEnd when for <= against even if quorum reached', () => {
		const p = parseProposalDetail(
			detail({ voteEnd: '200', forVotes: '1000', againstVotes: '1000', abstainVotes: '5000', quorumVotes: '2000' }),
		);
		expect(deriveProposalState(p, 250n)).toBe(DEFEATED);
	});
});

describe('voteId', () => {
	it('builds `<proposalId>-<lowercased address>` to match the subgraph Vote entity id', () => {
		// The subgraph stores Vote.id as proposalId + '-' + event.params.voter.toHexString()
		// (graph-ts toHexString is lowercase). A mismatch here silently breaks has-voted.
		expect(voteId('123', '0xAbC0000000000000000000000000000000000001')).toBe(
			'123-0xabc0000000000000000000000000000000000001',
		);
	});
});

describe('parseProposalTotals', () => {
	const node: SubgraphProposalNode = {
		id: '1574796912162685559525000651039927443322227363996739142551215918453240528045',
		proposalId:
			'1574796912162685559525000651039927443322227363996739142551215918453240528045',
		forVotes: '1600000000000000000000000', // 1,600,000 gKLC
		againstVotes: '0',
		abstainVotes: '0',
		quorumVotes: '2148000000000000000000000', // 2,148,000 gKLC
		voteCount: 3,
		status: 'Created',
	};

	it('parses raw wei strings into bigint and sums total = for+against+abstain', () => {
		const t = parseProposalTotals(node);
		expect(t.forVotes).toBe(1_600_000_000_000_000_000_000_000n);
		expect(t.againstVotes).toBe(0n);
		expect(t.abstainVotes).toBe(0n);
		expect(t.totalVotes).toBe(1_600_000_000_000_000_000_000_000n);
		expect(t.quorumVotes).toBe(2_148_000_000_000_000_000_000_000n);
		expect(t.voteCount).toBe(3);
	});

	it('quorum NOT reached when for+abstain is below quorumVotes (the live 1.6M < 2.148M case)', () => {
		expect(parseProposalTotals(node).quorumReached).toBe(false);
	});

	it('quorum reached counts For + Abstain (not Against) against the requirement', () => {
		// 1.0M For + 1.148M Abstain = 2.148M == quorum -> reached; big Against must not count
		const t = parseProposalTotals({
			...node,
			forVotes: '1000000000000000000000000',
			abstainVotes: '1148000000000000000000000',
			againstVotes: '9999000000000000000000000',
		});
		expect(t.quorumReached).toBe(true);
	});

	it('quorumReached is false when quorumVotes is 0 (not yet computed by the subgraph)', () => {
		// quorumVotes is 0 until the first vote lets the subgraph read quorum(snapshot).
		// Must not report "reached" just because 0 >= 0.
		const t = parseProposalTotals({ ...node, quorumVotes: '0' });
		expect(t.quorumReached).toBe(false);
	});
});

describe('queryProposalTotals', () => {
	const okResponse = (data: unknown) => ({
		ok: true,
		json: async () => ({ data }),
	});

	it('posts a GraphQL query to the url and parses proposals into totals', async () => {
		let captured: { url: string; body: { query: string } } | undefined;
		const fakeFetch = async (url: string, init: { body: string }) => {
			captured = { url, body: JSON.parse(init.body) };
			return okResponse({
				proposals: [
					{
						id: '1',
						proposalId: '1',
						forVotes: '1600000000000000000000000',
						againstVotes: '0',
						abstainVotes: '0',
						quorumVotes: '2148000000000000000000000',
						voteCount: 3,
						status: 'Created',
					},
				],
			});
		};

		const totals = await queryProposalTotals('http://sg', fakeFetch as never);

		expect(captured?.url).toBe('http://sg');
		expect(captured?.body.query).toContain('proposals');
		expect(totals).toHaveLength(1);
		expect(totals[0].proposalId).toBe('1');
		expect(totals[0].forVotes).toBe(1_600_000_000_000_000_000_000_000n);
	});

	it('returns [] (does not throw) on a network error so the caller can fall back on-chain', async () => {
		const boom = async () => {
			throw new Error('network down');
		};
		await expect(queryProposalTotals('http://sg', boom as never)).resolves.toEqual([]);
	});

	it('returns [] when the GraphQL response carries errors', async () => {
		const errResp = async () => ({
			ok: true,
			json: async () => ({ errors: [{ message: 'bad' }] }),
		});
		await expect(queryProposalTotals('http://sg', errResp as never)).resolves.toEqual([]);
	});
});

describe('parseVoteHistory', () => {
	const nodes: SubgraphVoteNode[] = [
		{
			id: '5-0xabc',
			voter: '0xABC0000000000000000000000000000000000001',
			support: 1,
			weight: '112000000000000000000000', // 112,000 gKLC
			reason: 'dude',
			timestamp: '1700000000',
			txHash: '0xdead',
		},
		{
			id: '5-0xdef',
			voter: '0xDEF0000000000000000000000000000000000002',
			support: 2,
			weight: '0',
			reason: '',
			timestamp: '1700000500',
			txHash: '0xbeef',
		},
	];

	it('maps subgraph Vote nodes into the render shape, weight->gKLC and ts->ms', () => {
		const h = parseVoteHistory(nodes);
		expect(h).toHaveLength(2);
		expect(h[0]).toMatchObject({
			voter_address: '0xABC0000000000000000000000000000000000001',
			support: 1,
			voting_power: 112000,
			reason: 'dude',
			timestamp: 1700000000 * 1000,
			transaction_hash: '0xdead',
		});
	});

	it('keeps a real 0-weight on-chain vote (it happened) but with power 0', () => {
		const h = parseVoteHistory(nodes);
		expect(h[1].voting_power).toBe(0);
		expect(h[1].support).toBe(2);
	});
});

describe('getDaoSubgraphUrl', () => {
	it('returns undefined for an unconfigured chain (e.g. testnet) so callers fall back on-chain', () => {
		// Testnet has no subgraph; env var unset in tests.
		expect(getDaoSubgraphUrl(3889)).toBeUndefined();
	});
});
