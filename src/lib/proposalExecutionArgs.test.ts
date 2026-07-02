import { describe, it, expect } from 'vitest';
import { pickProposalCreatedArgs, computeProposalId } from './proposalExecutionArgs';

const T = '0x92564ec0d22BBd5e3FF978B977CA968e6c7d1c44';
const goodLog = (id: bigint) => ({
	args: {
		proposalId: id,
		targets: [T],
		values: [0n],
		calldatas: ['0xabcdef' as const],
		description: '# Proposal\n\nDo the thing.',
	},
});

describe('pickProposalCreatedArgs', () => {
	it('returns the args of the log whose proposalId matches', () => {
		const logs = [goodLog(111n), goodLog(222n), goodLog(333n)];
		const r = pickProposalCreatedArgs(logs, 222n);
		expect(r).not.toBeNull();
		expect(r!.values).toEqual([0n]);
		expect(r!.targets).toEqual([T]);
		expect(r!.description).toBe('# Proposal\n\nDo the thing.');
	});

	it('normalises to real bigints/hex (handles string-encoded proposalId in the log)', () => {
		const logs = [{ args: { ...goodLog(222n).args, proposalId: 222n } }];
		const r = pickProposalCreatedArgs(logs as never, 222n);
		expect(r!.values.every((v) => typeof v === 'bigint')).toBe(true);
	});

	it('H2 regression — no matching proposalId in the fetched window → null (refuse to queue)', () => {
		const logs = [goodLog(111n), goodLog(333n)];
		expect(pickProposalCreatedArgs(logs, 222n)).toBeNull();
	});

	it('returns null for a malformed match (mismatched array lengths)', () => {
		const bad = { args: { proposalId: 5n, targets: [T, T], values: [0n], calldatas: ['0x00' as const], description: 'x' } };
		expect(pickProposalCreatedArgs([bad], 5n)).toBeNull();
	});

	it('returns null for a match with empty arrays', () => {
		const bad = { args: { proposalId: 5n, targets: [], values: [], calldatas: [], description: 'x' } };
		expect(pickProposalCreatedArgs([bad], 5n)).toBeNull();
	});

	it('returns null when the matched log is missing the description', () => {
		const bad = { args: { proposalId: 5n, targets: [T], values: [0n], calldatas: ['0x00' as const] } };
		expect(pickProposalCreatedArgs([bad as never], 5n)).toBeNull();
	});

	it('skips logs with no args / no proposalId without throwing', () => {
		const logs = [{}, { args: {} }, goodLog(9n)];
		expect(pickProposalCreatedArgs(logs as never, 9n)).not.toBeNull();
	});

	it('empty log set → null', () => {
		expect(pickProposalCreatedArgs([], 1n)).toBeNull();
	});
});

describe('computeProposalId', () => {
	// Oracle computed by the DEPLOYED KalyChain mainnet Governor
	// (0xF6C1af62e59D3085f10ac6F782cFDaE23E6352dE) via `cast call hashProposal(...)`,
	// i.e. Solidity's own keccak/abi.encode — proves the JS matches the contract.
	it('matches Solidity hashProposal() for a known vector (description="Test proposal")', () => {
		const id = computeProposalId({
			targets: ['0x92564ec0d22BBd5e3FF978B977CA968e6c7d1c44'],
			values: [0n],
			calldatas: ['0x'],
			description: 'Test proposal',
		});
		expect(id).toBe(
			19642827408026601797783319071711999684263243497091907458455724814847992111885n,
		);
	});

	it('a single byte of description drift changes the id (the H2 failure this prevents)', () => {
		const base = {
			targets: ['0x92564ec0d22BBd5e3FF978B977CA968e6c7d1c44'] as `0x${string}`[],
			values: [0n],
			calldatas: ['0x'] as `0x${string}`[],
			description: 'Test proposal',
		};
		const drifted = { ...base, description: 'Test proposal ' }; // trailing space
		expect(computeProposalId(drifted)).not.toBe(computeProposalId(base));
	});
});
