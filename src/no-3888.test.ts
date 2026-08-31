/**
 * Guards the 2026-08-27 migration of the DAO frontend to KalyChain 3890 (KMT / gKMT).
 * ONE chain: no 3888/3889 ids, no old contracts, no `chainId === 3889 ? testnet : mainnet`
 * fall-through, no KLC copy, hosts only in blockchain/config/chains.ts (+ the two subgraph
 * defaults), so the cut-day hostname switch stays env-only.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = __dirname;

const FORBIDDEN: RegExp[] = [
	/CONTRACT_ADDRESSES_BY_NETWORK|kalyChainMainnet|kalyChainTestnet|TREASURY_VAULT|isTestnet/,
	/-kalychain-mainnet/,
	/api\.coingecko\.com|allorigins/,
	/0x4BA2369743c4249ea3f6777CaF433c76dBBa657a|0xF6C1af62e59D3085f10ac6F782cFDaE23E6352dE|0xA11572e9724dfeD2BCf8ecc9bfEd18CC609C4c6D|0x92564ec0d22BBd5e3FF978B977CA968e6c7d1c44|0xeD23Fda4A23C0b6950dEcD55C4Bd757f644E0578|0x8Ab92A0B7Ec5a9EA877AD3b15bfEFB795aA24C33|0x92177A348367D0122e043448e7f308ba989CFb3F|0xAd338da8A2dDE5B5Fe08362c379c66D18Bb24151|0x5aE2cf3fC0B99003C64bBDC7836D08064ED43Aab|0x14daEbEDf316507ed450fecdA46B059E8037d367|0x069255299Bb729399f3CECaBdc73d15d3D10a2A3|0x2CA775C77B922A51FcF3097F52bFFdbc0250D99A/i,
];

// The retired chain ids may appear ONLY in the archive data helpers — the read-only
// /archive page needs the old id to query the preserved Supabase rows. Everything
// else must stay free of them (live code that names the old chain is a wrong-chain
// bug waiting to happen).
const OLD_CHAIN_ID = /\b388[89]\b/;
const OLD_CHAIN_ID_ALLOWED = ['lib/archive.ts'];

// The cutover notice and the governance archive are the ONLY components allowed to
// name the old ticker — one announces KLC became KMT at 110:1, the other preserves
// the pre-relaunch record. Everything else stays KLC-free.
const KLC_COPY = /\bg?KLC\b/;
const KLC_COPY_ALLOWED = ['components/CutoverNotice.tsx', 'components/archive/GovernanceArchive.tsx'];

const HOST = /[a-z0-9.-]*(kalyscan\.io|kalychain\.io\/rpc|app\.kalyswap\.io)/;
const HOST_ALLOWED = ['blockchain/config/chains.ts', 'lib/daoSubgraph.ts', 'blockchain/hooks/useKlcPriceV3.ts'];

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(tsx?|json)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
	}
	return out;
}

describe('KalyChain 3890 migration guard', () => {
	it('deleted files stay deleted', () => {
		for (const rel of ['components/test', 'blockchain/abis/TreasuryVault.json', 'components/proposals/CreateProposal.tsx.bak', 'stories']) {
			expect(existsSync(join(SRC, rel)), `${rel} was re-added`).toBe(false);
		}
	});

	it('no source references the old chains, contracts, switches or KLC copy', () => {
		const offenders: string[] = [];
		for (const file of walk(SRC)) {
			const text = readFileSync(file, 'utf8');
			for (const re of FORBIDDEN) if (re.test(text)) offenders.push(`${file.replace(SRC, 'src')} matches ${re}`);
			if (OLD_CHAIN_ID.test(text) && !OLD_CHAIN_ID_ALLOWED.some((a) => file.endsWith(a))) {
				offenders.push(`${file.replace(SRC, 'src')} matches ${OLD_CHAIN_ID}`);
			}
			if (KLC_COPY.test(text) && !KLC_COPY_ALLOWED.some((a) => file.endsWith(a))) {
				offenders.push(`${file.replace(SRC, 'src')} matches ${KLC_COPY}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('host literals live only in the chain/subgraph config', () => {
		const offenders = walk(SRC)
			.filter((f) => !HOST_ALLOWED.some((a) => f.endsWith(a)))
			.filter((f) => HOST.test(readFileSync(f, 'utf8')))
			.map((f) => f.replace(SRC, 'src'));
		expect(offenders).toEqual([]);
	});
});
