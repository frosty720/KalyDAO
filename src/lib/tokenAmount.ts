// Converts human-entered token amounts to base units using the token's ACTUAL
// decimals (audit H3). ActionBuilder used `parseEther` (hardcoded 18 decimals) for
// every ERC20 treasury transfer, so a payout of a 6-decimal token (e.g. bridged USDT)
// encoded 10^12x too much — TreasuryVault's `balanceOf >= amount` check then reverts
// at every execute, permanently bricking the passed proposal. Always scale by the real
// decimals read from the token contract.

import { parseUnits } from 'viem';

/**
 * Parse one human amount (e.g. "1000", "12.5") to base units for a token with
 * `decimals` decimals. Throws on empty/invalid input or more fractional digits than
 * the token supports — the caller treats a throw as "not encodable yet" (calldata 0x).
 */
export function toTokenAmount(amount: string, decimals: number): bigint {
	const trimmed = amount.trim();
	if (trimmed === '') throw new Error('Amount is empty');
	if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
		throw new Error(`Invalid token decimals: ${decimals}`);
	}
	// viem's parseUnits silently ROUNDS excess fractional digits; for a treasury
	// transfer we'd rather refuse than quietly change the amount. Reject up front.
	const fractional = trimmed.includes('.') ? trimmed.split('.')[1] ?? '' : '';
	if (fractional.length > decimals) {
		throw new Error(`Amount has more than ${decimals} decimal place(s) for this token`);
	}
	// parseUnits also throws on non-numeric input.
	return parseUnits(trimmed, decimals);
}

/**
 * Parse a comma-separated list of amounts (batch transfer) to base units. Throws if the
 * list is empty or any entry is invalid, so a partially-valid batch never encodes.
 */
export function toTokenAmountList(csv: string, decimals: number): bigint[] {
	const parts = csv.split(',').map((s) => s.trim()).filter((s) => s !== '');
	if (parts.length === 0) throw new Error('No amounts provided');
	return parts.map((p) => toTokenAmount(p, decimals));
}
