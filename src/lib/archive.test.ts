import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ARCHIVE_CHAIN_ID, formatVotes, shortHex, supportLabel } from './archive';

const ARCHIVE_PAGE = join(__dirname, '../components/archive/GovernanceArchive.tsx');

describe('governance archive helpers', () => {
	it('reads the retired chain, never the live one', () => {
		expect(ARCHIVE_CHAIN_ID).toBe(3888);
	});

	it('maps votes_history.support per 002_create_votes_history_table.sql', () => {
		expect(supportLabel(0)).toBe('Against');
		expect(supportLabel(1)).toBe('For');
		expect(supportLabel(2)).toBe('Abstain');
		expect(supportLabel(3)).toBe('Unknown');
		expect(supportLabel(-1)).toBe('Unknown');
	});

	it('formats tallies like ProposalCard', () => {
		expect(formatVotes(999)).toBe('999');
		expect(formatVotes(1250)).toBe('1.3K');
		expect(formatVotes(2500000)).toBe('2.5M');
		expect(formatVotes(0)).toBe('0');
	});

	it('shortens hex strings and keeps short values intact', () => {
		expect(shortHex('0x1234567890abcdef', 6, 4)).toBe('0x1234…cdef');
		expect(shortHex('0xabc')).toBe('0xabc');
		expect(shortHex('')).toBe('');
	});
});

describe('governance archive page', () => {
	const source = readFileSync(ARCHIVE_PAGE, 'utf8');

	it('queries archived rows through the shared constant only', () => {
		expect(source).toContain('ARCHIVE_CHAIN_ID');
		expect(source).toContain("from(\"proposals\")");
		expect(source).toContain("from(\"votes_history\")");
	});

	it('is read-only — no Supabase writes', () => {
		expect(source).not.toMatch(/\.(insert|update|upsert|delete)\(/);
	});

	it('has no explorer links (the old explorer is retired)', () => {
		expect(source).not.toMatch(/explorerTx|explorerAddress|EXPLORER_URL/);
		expect(source).not.toMatch(/href=/);
	});
});
