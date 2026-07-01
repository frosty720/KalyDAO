// DAO subgraph data layer.
//
// The KalyDAO Governor subgraph (deployed as `dao-subgraph-kalychain-mainnet`) is
// the source of truth for multi-proposal vote totals and vote history. Vote weights
// are the real on-chain `VoteCast.weight`, so Supabase no longer counts votes.
//
// Only mainnet has a subgraph; for any other chain (e.g. testnet) `getDaoSubgraphUrl`
// returns undefined and callers fall back to direct on-chain reads.

const MAINNET_CHAIN_ID = 3888;
const TESTNET_CHAIN_ID = 3889;

export interface SubgraphProposalNode {
	id: string;
	proposalId: string;
	forVotes: string;
	againstVotes: string;
	abstainVotes: string;
	quorumVotes: string;
	voteCount: number;
	status: string;
}

export interface ProposalTotals {
	proposalId: string;
	/** Raw 18-decimal gKLC wei */
	forVotes: bigint;
	againstVotes: bigint;
	abstainVotes: bigint;
	totalVotes: bigint;
	quorumVotes: bigint;
	/** For + Abstain >= quorumVotes (and quorum is known). Against never counts. */
	quorumReached: boolean;
	voteCount: number;
	status: string;
}

export interface SubgraphVoteNode {
	id: string;
	voter: string;
	support: number;
	weight: string;
	reason: string;
	timestamp: string;
	txHash: string;
}

/** Shape consumed by the Vote History UI (kept identical to the old Supabase rows). */
export interface VoteHistoryEntry {
	id: string;
	voter_address: string;
	support: number;
	voting_power: number;
	reason?: string;
	timestamp: number;
	transaction_hash: string;
}

export function parseVoteHistory(nodes: SubgraphVoteNode[]): VoteHistoryEntry[] {
	return nodes.map((n) => ({
		id: n.id,
		voter_address: n.voter,
		support: n.support,
		voting_power: Number(BigInt(n.weight)) / 1e18,
		reason: n.reason || undefined,
		timestamp: Number(n.timestamp) * 1000,
		transaction_hash: n.txHash,
	}));
}

/** Build the Vote entity id used by the subgraph: `<proposalId>-<lowercased voter>`. */
export function voteId(proposalId: string, voter: string): string {
	return `${proposalId}-${voter.toLowerCase()}`;
}

export function parseProposalTotals(node: SubgraphProposalNode): ProposalTotals {
	const forVotes = BigInt(node.forVotes);
	const againstVotes = BigInt(node.againstVotes);
	const abstainVotes = BigInt(node.abstainVotes);
	const quorumVotes = BigInt(node.quorumVotes);

	const quorumBasis = forVotes + abstainVotes; // GovernorCountingSimple: For + Abstain
	const quorumReached = quorumVotes > 0n && quorumBasis >= quorumVotes;

	return {
		proposalId: node.proposalId,
		forVotes,
		againstVotes,
		abstainVotes,
		totalVotes: forVotes + againstVotes + abstainVotes,
		quorumVotes,
		quorumReached,
		voteCount: node.voteCount,
		status: node.status,
	};
}

// ── Full proposal detail (single-proposal page) ─────────────────────────────
export interface SubgraphProposalDetailNode {
	id: string;
	proposalId: string;
	proposer: string;
	voteStart: string;
	voteEnd: string;
	forVotes: string;
	againstVotes: string;
	abstainVotes: string;
	quorumVotes: string;
	status: string;
	eta: string | null;
}

export interface ProposalDetail {
	proposalId: string;
	proposer: string;
	/** voteStart / voteEnd are BLOCK numbers */
	voteStart: bigint;
	voteEnd: bigint;
	forVotes: bigint;
	againstVotes: bigint;
	abstainVotes: bigint;
	quorumVotes: bigint;
	quorumReached: boolean;
	/** last lifecycle event: Created | Queued | Executed | Canceled */
	status: string;
	/** timelock eta (unix seconds) once queued */
	eta: bigint | null;
}

export function parseProposalDetail(node: SubgraphProposalDetailNode): ProposalDetail {
	const forVotes = BigInt(node.forVotes);
	const againstVotes = BigInt(node.againstVotes);
	const abstainVotes = BigInt(node.abstainVotes);
	const quorumVotes = BigInt(node.quorumVotes);
	return {
		proposalId: node.proposalId,
		proposer: node.proposer,
		voteStart: BigInt(node.voteStart),
		voteEnd: BigInt(node.voteEnd),
		forVotes,
		againstVotes,
		abstainVotes,
		quorumVotes,
		// GovernorCountingSimple: quorum counts For + Abstain. quorumVotes is 0 until the
		// first vote lets the subgraph read quorum(voteStart), so 0 => not yet reached.
		quorumReached: quorumVotes > 0n && forVotes + abstainVotes >= quorumVotes,
		status: node.status,
		eta: node.eta != null ? BigInt(node.eta) : null,
	};
}

/**
 * Derive the live OZ Governor state index from subgraph data + the current block.
 * `status` is only the last lifecycle EVENT (Created/Queued/Executed/Canceled);
 * Pending/Active/Succeeded/Defeated are not events, so we compute them here — this
 * mirrors GovernorTimelockControl.state(). Returns the enum index used by the UI's
 * `states` array: 0 Pending, 1 Active, 2 Canceled, 3 Defeated, 4 Succeeded, 5 Queued,
 * 6 Expired, 7 Executed. (Expired needs the timelock grace period; we treat a queued
 * proposal as Queued and let the execute tx enforce the real state.)
 */
export function deriveProposalState(p: ProposalDetail, currentBlock: bigint): number {
	if (p.status === 'Executed') return 7;
	if (p.status === 'Canceled') return 2;
	if (p.status === 'Queued') return 5;
	// status === 'Created' — voting lifecycle:
	if (currentBlock <= p.voteStart) return 0; // Pending
	if (currentBlock <= p.voteEnd) return 1; // Active
	// Voting ended, not queued: Succeeded iff quorum reached AND for > against.
	return p.quorumReached && p.forVotes > p.againstVotes ? 4 : 3;
}

type FetchLike = (
	url: string,
	init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const PROPOSAL_TOTALS_QUERY = `{
  proposals(first: 1000, orderBy: createdAtBlock, orderDirection: desc) {
    id
    proposalId
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    voteCount
    status
  }
}`;

/**
 * Fetch every proposal's vote totals from the subgraph in one request. Never
 * throws: on any network/GraphQL error it returns [] so callers can fall back to
 * on-chain reads. One request replaces N per-proposal RPC calls on the list page.
 */
export async function queryProposalTotals(
	url: string,
	fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<ProposalTotals[]> {
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query: PROPOSAL_TOTALS_QUERY }),
		});
		if (!res.ok) return [];
		const json = (await res.json()) as {
			data?: { proposals?: SubgraphProposalNode[] };
			errors?: unknown;
		};
		if (json.errors || !json.data?.proposals) return [];
		return json.data.proposals.map(parseProposalTotals);
	} catch {
		return [];
	}
}

/**
 * Fetch a proposal's vote history (real on-chain VoteCast events) from the subgraph.
 * Never throws: returns [] on any error so callers can fall back to on-chain logs.
 */
export async function queryVoteHistory(
	url: string,
	proposalId: string,
	fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<VoteHistoryEntry[]> {
	const query = `{
  votes(where: { proposal: "${proposalId}" }, orderBy: timestamp, orderDirection: desc, first: 1000) {
    id voter support weight reason timestamp txHash
  }
}`;
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query }),
		});
		if (!res.ok) return [];
		const json = (await res.json()) as {
			data?: { votes?: SubgraphVoteNode[] };
			errors?: unknown;
		};
		if (json.errors || !json.data?.votes) return [];
		return parseVoteHistory(json.data.votes);
	} catch {
		return [];
	}
}

/**
 * Fetch a single proposal's full detail (proposer, blocks, votes, quorum, status,
 * eta) in one request. Returns null on any error so callers fall back to on-chain.
 * Replaces ~7 per-proposal RPC reads (proposalVotes, quorum, snapshot, deadline,
 * proposalProposer, proposalEta, state) with one GraphQL call.
 */
export async function queryProposalDetail(
	url: string,
	proposalId: string,
	fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<ProposalDetail | null> {
	const query = `{
  proposal(id: "${proposalId}") {
    id proposalId proposer voteStart voteEnd forVotes againstVotes abstainVotes quorumVotes status eta
  }
}`;
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query }),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: { proposal?: SubgraphProposalDetailNode | null };
			errors?: unknown;
		};
		if (json.errors || !json.data?.proposal) return null;
		return parseProposalDetail(json.data.proposal);
	} catch {
		return null;
	}
}

/**
 * Has a given voter already voted on a proposal? Looks up the immutable Vote entity
 * (`<proposalId>-<voter>`). Returns false on any error / missing voter so callers can
 * fall back to the on-chain `hasVoted` read.
 */
export async function queryHasVoted(
	url: string,
	proposalId: string,
	voter: string,
	fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
	if (!voter) return false;
	const query = `{ vote(id: "${voteId(proposalId, voter)}") { id } }`;
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query }),
		});
		if (!res.ok) return false;
		const json = (await res.json()) as { data?: { vote?: { id: string } | null }; errors?: unknown };
		if (json.errors) return false;
		return !!json.data?.vote;
	} catch {
		return false;
	}
}

export interface GovernorInfo {
	/** Quorum numerator (e.g. 4 == 4%) */
	quorumNumerator: bigint;
	/** Quorum denominator (default 100) */
	quorumDenominator: bigint;
	votingDelay: bigint;
	votingPeriod: bigint;
	proposalThreshold: bigint;
	totalProposals: bigint;
}

/**
 * Fetch the Governor config (quorum fraction, voting delay/period, threshold, total
 * proposals) from the subgraph. Returns null on any error so callers fall back to
 * on-chain reads. Replaces the quorumNumerator / quorumVotes / quorum(block) RPC reads.
 */
export async function queryGovernor(
	url: string,
	fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<GovernorInfo | null> {
	const query = `{
  governors(first: 1) {
    quorumNumerator quorumDenominator votingDelay votingPeriod proposalThreshold totalProposals
  }
}`;
	try {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query }),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: {
				governors?: {
					quorumNumerator: string;
					quorumDenominator: string;
					votingDelay: string;
					votingPeriod: string;
					proposalThreshold: string;
					totalProposals: string;
				}[];
			};
			errors?: unknown;
		};
		const g = json.data?.governors?.[0];
		if (json.errors || !g) return null;
		return {
			quorumNumerator: BigInt(g.quorumNumerator),
			quorumDenominator: BigInt(g.quorumDenominator),
			votingDelay: BigInt(g.votingDelay),
			votingPeriod: BigInt(g.votingPeriod),
			proposalThreshold: BigInt(g.proposalThreshold),
			totalProposals: BigInt(g.totalProposals),
		};
	} catch {
		return null;
	}
}

/**
 * Public query URL for the DAO subgraph on a given chain, or undefined if none is
 * configured. Env-driven (no hardcoded URLs); set VITE_DAO_SUBGRAPH_URL_MAINNET.
 */
export function getDaoSubgraphUrl(chainId: number): string | undefined {
	const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
	if (chainId === MAINNET_CHAIN_ID) {
		return env.VITE_DAO_SUBGRAPH_URL_MAINNET || env.VITE_DAO_SUBGRAPH_URL || undefined;
	}
	if (chainId === TESTNET_CHAIN_ID) {
		return env.VITE_DAO_SUBGRAPH_URL_TESTNET || undefined;
	}
	return undefined;
}
