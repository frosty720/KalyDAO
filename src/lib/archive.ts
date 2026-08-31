/**
 * Read-only "Governance archive" helpers. Proposals and votes from the pre-relaunch
 * chain stay in Supabase as a public record; the live UI is single-chain 3890 and
 * filters them out, so the /archive page reads them through these helpers instead.
 *
 * This module owns the ONE allowed source literal for the retired chain id — see
 * OLD_CHAIN_ID_ALLOWED in src/no-3888.test.ts. Import ARCHIVE_CHAIN_ID; never write
 * the number anywhere else.
 */

/** Chain id of the retired pre-relaunch KalyChain — used only to read archived rows. */
export const ARCHIVE_CHAIN_ID = 3888;

/** votes_history.support: 0=against, 1=for, 2=abstain (002_create_votes_history_table.sql). */
export function supportLabel(support: number): 'For' | 'Against' | 'Abstain' | 'Unknown' {
	switch (support) {
		case 0:
			return 'Against';
		case 1:
			return 'For';
		case 2:
			return 'Abstain';
		default:
			return 'Unknown';
	}
}

/** 1.2M / 3.4K style, matching ProposalCard's tally formatting. */
export function formatVotes(num: number): string {
	return num >= 1000000
		? `${(num / 1000000).toFixed(1)}M`
		: num >= 1000
			? `${(num / 1000).toFixed(1)}K`
			: num.toString();
}

/** 0x1234…abcd for table display; put the full value in the title attribute. */
export function shortHex(value: string, lead = 6, tail = 4): string {
	if (!value || value.length <= lead + tail + 1) return value || '';
	return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
