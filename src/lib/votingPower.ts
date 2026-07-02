// Voting-power resolution for a specific proposal.
//
// The OZ Governor counts a vote with getPastVotes(voter, proposalSnapshot) — the
// wallet's DELEGATED power at the snapshot block — never its live balance. The UI
// previously displayed/gated on the live gKLC balance, which let wallets that
// wrapped or delegated AFTER the snapshot cast recorded-but-zero-weight votes
// (July 2026 mainnet incident: three wallets, 126M gKLC, all counted 0).
// This module resolves the number the Governor will actually use, plus a flag for
// the "acquired after snapshot" case so the UI can explain it instead of lying.

export interface ResolveVotingPowerInputs {
	/** getPastVotes(voter, snapshot) in wei; undefined while loading or unanswerable */
	snapshotPowerWei?: bigint;
	/** getVotes(voter) — live delegated power in wei; undefined while loading */
	currentPowerWei?: bigint;
	/** True once the snapshot block has been mined (getPastVotes is answerable) */
	snapshotMined: boolean;
}

export interface ResolvedVotingPower {
	/** Power the Governor will count for this proposal, in wei */
	effectivePowerWei: bigint;
	/** Wallet has live power but had none at the snapshot: a vote would record 0 weight */
	acquiredAfterSnapshot: boolean;
}

export function resolveVotingPower(inputs: ResolveVotingPowerInputs): ResolvedVotingPower {
	if (!inputs.snapshotMined) {
		// Proposal still Pending: power can change until the snapshot block, so live
		// delegated power is the honest estimate. Voting is impossible in this state
		// anyway (Governor rejects until Active), so this value is display-only.
		return {
			effectivePowerWei: inputs.currentPowerWei ?? 0n,
			acquiredAfterSnapshot: false,
		};
	}
	if (inputs.snapshotPowerWei === undefined) {
		// Snapshot read still loading — fail closed (no vote controls) rather than
		// fall back to the live balance, which is the exact bug this module fixes.
		return { effectivePowerWei: 0n, acquiredAfterSnapshot: false };
	}
	return {
		effectivePowerWei: inputs.snapshotPowerWei,
		acquiredAfterSnapshot:
			inputs.snapshotPowerWei === 0n && (inputs.currentPowerWei ?? 0n) > 0n,
	};
}
