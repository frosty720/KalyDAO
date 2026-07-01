import { describe, it, expect } from 'vitest';
import { decodeFunctionData } from 'viem';
import {
	buildSignalingAction,
	signalingKeyFromTitle,
	isValidActionTarget,
	SIGNALING_CATEGORY,
	SIGNALING_VALUE,
} from './proposals';

const DAO_SETTINGS = '0xeD23Fda4A23C0b6950dEcD55C4Bd757f644E0578' as const;

// Re-declared here (the source keeps it private) so we can decode the generated
// calldata and assert it is a real setStringParameter call with the right args.
const daoSettingsSignalAbi = [
	{
		inputs: [
			{ internalType: 'string', name: 'category', type: 'string' },
			{ internalType: 'string', name: 'key', type: 'string' },
			{ internalType: 'string', name: 'value', type: 'string' },
		],
		name: 'setStringParameter',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
] as const;

describe('signalingKeyFromTitle', () => {
	it('slugifies a normal title', () => {
		expect(signalingKeyFromTitle('Update the Genesis File')).toBe('signal_update_the_genesis_file');
	});

	it('collapses punctuation/whitespace and trims edge underscores', () => {
		expect(signalingKeyFromTitle('  Approve!! Budget 2026 — Q1??  ')).toBe('signal_approve_budget_2026_q1');
	});

	it('bounds the slug length to 64 chars', () => {
		const longTitle = 'a'.repeat(200);
		const key = signalingKeyFromTitle(longTitle);
		// 'signal_' (7) + up to 64 slug chars
		expect(key.length).toBeLessThanOrEqual(7 + 64);
		expect(key.startsWith('signal_')).toBe(true);
	});

	it('falls back to "signal" when nothing slugifiable remains', () => {
		expect(signalingKeyFromTitle('!!!')).toBe('signal');
		expect(signalingKeyFromTitle('')).toBe('signal');
	});
});

describe('buildSignalingAction', () => {
	it('targets DAOSettings with zero value', () => {
		const action = buildSignalingAction(DAO_SETTINGS, 'Update the Genesis File');
		expect(action.target).toBe(DAO_SETTINGS);
		expect(action.value).toBe('0');
		expect(action.calldata.startsWith('0x')).toBe(true);
	});

	it('encodes a real setStringParameter(category, key, value) call', () => {
		const title = 'Update the Genesis File';
		const action = buildSignalingAction(DAO_SETTINGS, title);

		const decoded = decodeFunctionData({
			abi: daoSettingsSignalAbi,
			data: action.calldata,
		});

		expect(decoded.functionName).toBe('setStringParameter');
		expect(decoded.args).toEqual([
			SIGNALING_CATEGORY,
			signalingKeyFromTitle(title),
			SIGNALING_VALUE,
		]);
	});

	it('produces different calldata for different titles (distinct keys)', () => {
		const a = buildSignalingAction(DAO_SETTINGS, 'Proposal A');
		const b = buildSignalingAction(DAO_SETTINGS, 'Proposal B');
		expect(a.calldata).not.toBe(b.calldata);
	});
});

describe('isValidActionTarget', () => {
	it('accepts a well-formed non-zero address', () => {
		expect(isValidActionTarget(DAO_SETTINGS)).toBe(true);
	});

	it('rejects the zero address', () => {
		expect(isValidActionTarget('0x0000000000000000000000000000000000000000')).toBe(false);
	});

	it('rejects empty and malformed inputs', () => {
		expect(isValidActionTarget('')).toBe(false);
		expect(isValidActionTarget('0x123')).toBe(false);
		expect(isValidActionTarget('not-an-address')).toBe(false);
		// too long
		expect(isValidActionTarget(DAO_SETTINGS + 'ab')).toBe(false);
	});
});
