import { describe, it, expect } from 'vitest';
import { toTokenAmount, toTokenAmountList } from './tokenAmount';

describe('toTokenAmount', () => {
	it('H3 regression — 1000 of a 6-decimal token = 1_000_000_000 (NOT 1000e18)', () => {
		expect(toTokenAmount('1000', 6)).toBe(1_000_000_000n);
		// The old parseEther bug would have produced this instead:
		expect(toTokenAmount('1000', 6)).not.toBe(1000n * 10n ** 18n);
	});

	it('18-decimal token still scales by 1e18', () => {
		expect(toTokenAmount('1000', 18)).toBe(1000n * 10n ** 18n);
	});

	it('0-decimal token: whole units only', () => {
		expect(toTokenAmount('5', 0)).toBe(5n);
	});

	it('8-decimal token (e.g. WBTC) with fractional amount', () => {
		expect(toTokenAmount('1.5', 8)).toBe(150_000_000n);
	});

	it('trims surrounding whitespace', () => {
		expect(toTokenAmount('  250  ', 6)).toBe(250_000_000n);
	});

	it('throws on empty amount', () => {
		expect(() => toTokenAmount('', 6)).toThrow();
		expect(() => toTokenAmount('   ', 6)).toThrow();
	});

	it('throws on non-numeric amount', () => {
		expect(() => toTokenAmount('abc', 6)).toThrow();
	});

	it('throws on more fractional digits than the token supports', () => {
		// 0-decimal token can't hold a fraction.
		expect(() => toTokenAmount('1.5', 0)).toThrow();
		// 6-decimal token can't hold 7 fractional digits.
		expect(() => toTokenAmount('1.0000001', 6)).toThrow();
	});

	it('throws on nonsensical decimals', () => {
		expect(() => toTokenAmount('1', -1)).toThrow();
		expect(() => toTokenAmount('1', 1.5)).toThrow();
	});
});

describe('toTokenAmountList', () => {
	it('parses a batch with the token decimals', () => {
		expect(toTokenAmountList('100, 200, 300', 6)).toEqual([
			100_000_000n,
			200_000_000n,
			300_000_000n,
		]);
	});

	it('ignores empty trailing entries from a trailing comma', () => {
		expect(toTokenAmountList('100, 200,', 6)).toEqual([100_000_000n, 200_000_000n]);
	});

	it('throws if any entry is invalid (no partial batch)', () => {
		expect(() => toTokenAmountList('100, oops, 300', 6)).toThrow();
	});

	it('throws on an empty list', () => {
		expect(() => toTokenAmountList('   ', 6)).toThrow();
	});
});
