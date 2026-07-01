import { describe, it, expect } from 'vitest';
import {
	isSpecialProposal,
	SPECIAL_PROPOSAL_IDS,
	resolveDisplayVotes,
} from './proposalVotes';

describe('isSpecialProposal', () => {
	it('is true for the two injected legacy proposals (#1 and #2)', () => {
		expect(SPECIAL_PROPOSAL_IDS).toHaveLength(2);
		expect(isSpecialProposal(SPECIAL_PROPOSAL_IDS[0])).toBe(true);
		expect(isSpecialProposal(SPECIAL_PROPOSAL_IDS[1])).toBe(true);
	});

	it('is false for any other id, including undefined/empty', () => {
		expect(isSpecialProposal('999')).toBe(false);
		expect(isSpecialProposal('')).toBe(false);
		expect(isSpecialProposal(undefined)).toBe(false);
	});
});

describe('resolveDisplayVotes', () => {
	const onChain = { forVotes: 1_600_000, againstVotes: 0, abstainVotes: 0 };
	const supabase = { forVotes: 1_900_000, againstVotes: 0, abstainVotes: 0 };

	it('uses on-chain votes for a normal proposal (kills the 1.9M Supabase inflation)', () => {
		const r = resolveDisplayVotes({ isSpecial: false, onChain, supabase });
		expect(r.forVotes).toBe(1_600_000);
		expect(r.totalVotes).toBe(1_600_000);
		expect(r.source).toBe('onchain');
	});

	it('keeps the injected Supabase values for a special legacy proposal (#1/#2 untouched)', () => {
		const r = resolveDisplayVotes({
			isSpecial: true,
			onChain: { forVotes: 0, againstVotes: 0, abstainVotes: 0 },
			supabase: { forVotes: 54_500_000, againstVotes: 0, abstainVotes: 500_000 },
		});
		expect(r.forVotes).toBe(54_500_000);
		expect(r.abstainVotes).toBe(500_000);
		expect(r.totalVotes).toBe(55_000_000);
		expect(r.source).toBe('override');
	});
});
