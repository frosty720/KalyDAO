// Legacy proposal override + vote-display source resolution.
//
// Proposals #1 and #2 were "injected as passing" in Supabase before the team
// understood the on-chain quorum. On-chain they are Defeated; the DAO intentionally
// keeps displaying them as Passed. These IDs are the permanent display override:
// the subgraph/on-chain vote logic SKIPS them and renders their stored Supabase
// values. Do not remove or repoint these without an explicit decision.

export const SPECIAL_PROPOSAL_IDS: readonly string[] = [
	'12623673203887461246269581229455579568013705045965966107251015964351781522822',
	'106263624122153916398275663853816204925483415506769348757861184086135002881292',
];

export function isSpecialProposal(id: string | undefined | null): boolean {
	return id != null && SPECIAL_PROPOSAL_IDS.includes(id);
}

export interface VoteTriple {
	forVotes: number;
	againstVotes: number;
	abstainVotes: number;
}

export interface DisplayVotes extends VoteTriple {
	totalVotes: number;
	/** 'override' = injected Supabase values for #1/#2; 'onchain' = real chain truth. */
	source: 'override' | 'onchain';
}

/**
 * Decide which vote numbers to show. Special legacy proposals keep their injected
 * Supabase values; every other proposal uses on-chain truth (which removes the
 * Supabase-inflated totals that caused the 1.6M-vs-1.9M mismatch).
 */
export function resolveDisplayVotes(input: {
	isSpecial: boolean;
	onChain: VoteTriple;
	supabase: VoteTriple;
}): DisplayVotes {
	const src = input.isSpecial ? input.supabase : input.onChain;
	return {
		forVotes: src.forVotes,
		againstVotes: src.againstVotes,
		abstainVotes: src.abstainVotes,
		totalVotes: src.forVotes + src.againstVotes + src.abstainVotes,
		source: input.isSpecial ? 'override' : 'onchain',
	};
}
