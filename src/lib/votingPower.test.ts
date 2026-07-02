import { describe, it, expect } from 'vitest';
import { resolveVotingPower } from './votingPower';

const GKLC = (n: number) => BigInt(n) * 10n ** 18n;

describe('resolveVotingPower', () => {
	it('July 2026 incident: wallet wrapped+delegated AFTER snapshot must resolve to 0 with the flag set', () => {
		// Wallet 0x3937… held 15M gKLC live but 0 at the snapshot — the Governor
		// recorded its vote with weight 0 while the UI claimed 15M.
		const r = resolveVotingPower({
			snapshotPowerWei: 0n,
			currentPowerWei: GKLC(15_000_000),
			snapshotMined: true,
		});
		expect(r.effectivePowerWei).toBe(0n);
		expect(r.acquiredAfterSnapshot).toBe(true);
	});

	it('holder delegated before snapshot: snapshot power is used even if live power differs', () => {
		const r = resolveVotingPower({
			snapshotPowerWei: GKLC(100_000),
			currentPowerWei: GKLC(250_000), // topped up mid-proposal — extra does NOT count
			snapshotMined: true,
		});
		expect(r.effectivePowerWei).toBe(GKLC(100_000));
		expect(r.acquiredAfterSnapshot).toBe(false);
	});

	it('holder who unwrapped AFTER snapshot can still vote with snapshot power (OZ rule)', () => {
		// The old balance-based check wrongly blocked this legitimate voter.
		const r = resolveVotingPower({
			snapshotPowerWei: GKLC(100_000),
			currentPowerWei: 0n,
			snapshotMined: true,
		});
		expect(r.effectivePowerWei).toBe(GKLC(100_000));
		expect(r.acquiredAfterSnapshot).toBe(false);
	});

	it('wallet with no power at snapshot and none now: 0, no flag', () => {
		const r = resolveVotingPower({
			snapshotPowerWei: 0n,
			currentPowerWei: 0n,
			snapshotMined: true,
		});
		expect(r.effectivePowerWei).toBe(0n);
		expect(r.acquiredAfterSnapshot).toBe(false);
	});

	it('pending proposal (snapshot not mined): shows live power, never flags', () => {
		const r = resolveVotingPower({
			snapshotPowerWei: undefined,
			currentPowerWei: GKLC(50_000),
			snapshotMined: false,
		});
		expect(r.effectivePowerWei).toBe(GKLC(50_000));
		expect(r.acquiredAfterSnapshot).toBe(false);
	});

	it('snapshot mined but read still loading: fails closed to 0 (never falls back to live balance)', () => {
		const r = resolveVotingPower({
			snapshotPowerWei: undefined,
			currentPowerWei: GKLC(15_000_000),
			snapshotMined: true,
		});
		expect(r.effectivePowerWei).toBe(0n);
		expect(r.acquiredAfterSnapshot).toBe(false);
	});

	it('everything undefined (disconnected / loading): 0, no flag', () => {
		const r = resolveVotingPower({ snapshotMined: false });
		expect(r.effectivePowerWei).toBe(0n);
		expect(r.acquiredAfterSnapshot).toBe(false);
	});
});
