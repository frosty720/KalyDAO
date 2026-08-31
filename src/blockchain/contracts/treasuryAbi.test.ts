import { describe, it, expect } from 'vitest';
import { encodeFunctionData, toFunctionSelector, getAbiItem, parseEther } from 'viem';
import { treasuryAbi } from './treasuryAbi';

// Selectors verified against the deployed 3890 Treasury bytecode (cast sig, 2026-08-27).
describe('treasuryAbi', () => {
	it('matches the deployed Treasury.sol selectors', () => {
		expect(toFunctionSelector(getAbiItem({ abi: treasuryAbi, name: 'sendNative' }))).toBe('0x66807566');
		expect(toFunctionSelector(getAbiItem({ abi: treasuryAbi, name: 'sendERC20' }))).toBe('0x8f975a64');
		expect(toFunctionSelector(getAbiItem({ abi: treasuryAbi, name: 'execute' }))).toBe('0xb61d27f6');
	});
	it('encodes a native transfer proposal action the Timelock can execute', () => {
		const data = encodeFunctionData({ abi: treasuryAbi, functionName: 'sendNative', args: ['0x000000000000000000000000000000000000dEaD', parseEther('1')] });
		expect(data.startsWith('0x66807566')).toBe(true);
		expect(data.length).toBe(2 + 8 + 64 * 2);
	});
});
