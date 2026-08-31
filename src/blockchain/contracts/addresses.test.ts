import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CONTRACT_ADDRESSES, GOVERNOR_DEPLOY_BLOCK } from './addresses';

// KalyChain/kalychain-ops/files/kmt-3890/addresses.json — the ecosystem address book.
const OPS_BOOK = join(__dirname, '..', '..', '..', '..', '..', 'kalychain-ops', 'files', 'kmt-3890', 'addresses.json');
const lc = (s: string) => s.toLowerCase();

describe('DAO addresses (KalyChain 3890)', () => {
	it('match the ops address book', () => {
		expect(existsSync(OPS_BOOK), `address book not found at ${OPS_BOOK}`).toBe(true);
		const dao = JSON.parse(readFileSync(OPS_BOOK, 'utf8')).dao;
		expect(lc(CONTRACT_ADDRESSES.GOVERNANCE_TOKEN)).toBe(lc(dao.governanceToken_gKMT));
		expect(lc(CONTRACT_ADDRESSES.GOVERNOR_CONTRACT)).toBe(lc(dao.governor));
		expect(lc(CONTRACT_ADDRESSES.TIMELOCK)).toBe(lc(dao.timelock));
		expect(lc(CONTRACT_ADDRESSES.DAO_SETTINGS)).toBe(lc(dao.daoSettings));
		expect(lc(CONTRACT_ADDRESSES.TREASURY)).toBe(lc(dao.treasury));
	});
	it('has no TreasuryVault (it was never deployed on 3890) and a plausible Governor deploy block', () => {
		expect(CONTRACT_ADDRESSES).not.toHaveProperty('TREASURY_VAULT');
		expect(GOVERNOR_DEPLOY_BLOCK).toBe(7276n);
	});
});
