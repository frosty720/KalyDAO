// Reconstructs a proposal's queue()/execute() arguments from the on-chain
// `ProposalCreated` event instead of the mutable Supabase copy (audit H2).
//
// The Governor recomputes proposalId = hashProposal(targets, values, calldatas,
// keccak256(description)); queue/execute revert "unknown proposal id" if ANY of those
// four inputs differs by a byte. Sourcing them from an anon-writable database means an
// edited/absent row silently bricks a passed proposal. `ProposalCreated` carries the
// authoritative proposalId + targets/values/calldatas/description, so we match on it.
//
// This module holds the PURE selection/normalisation logic (unit-tested). The RPC log
// fetch + on-chain hashProposal verification live in the component.

/** Decoded `ProposalCreated` args as viem returns them (bigints, hex strings). */
export interface ProposalCreatedArgs {
	proposalId?: bigint;
	targets?: readonly string[];
	values?: readonly bigint[];
	calldatas?: readonly string[];
	description?: string;
}

export interface ExecutionArgs {
	targets: `0x${string}`[];
	values: bigint[];
	calldatas: `0x${string}`[];
	description: string;
}

import { keccak256, toBytes, encodeAbiParameters, parseAbiParameters } from 'viem';

/**
 * Recompute a proposal's id the way OZ Governor does:
 *   uint256(keccak256(abi.encode(targets, values, calldatas, keccak256(bytes(description)))))
 * Used to verify reconstructed args hash back to the expected on-chain id BEFORE
 * sending a queue/execute tx, so we never broadcast a guaranteed "unknown proposal id"
 * revert. Pure — no RPC, so it can't be spoofed by a malicious node and is unit-tested.
 */
export function computeProposalId(args: ExecutionArgs): bigint {
	const descriptionHash = keccak256(toBytes(args.description));
	const encoded = encodeAbiParameters(
		parseAbiParameters('address[], uint256[], bytes[], bytes32'),
		[args.targets, args.values, args.calldatas, descriptionHash],
	);
	return BigInt(keccak256(encoded));
}

/**
 * From a set of decoded `ProposalCreated` logs, return the execution args for the log
 * whose proposalId matches `proposalId`. Returns null when there is no exact match or
 * the matched log is malformed (missing/mismatched-length arrays), so the caller can
 * refuse to queue/execute rather than send a guaranteed revert.
 */
export function pickProposalCreatedArgs(
	logs: ReadonlyArray<{ args?: ProposalCreatedArgs }>,
	proposalId: bigint,
): ExecutionArgs | null {
	for (const log of logs) {
		const a = log?.args;
		if (!a || a.proposalId === undefined) continue;
		if (BigInt(a.proposalId) !== proposalId) continue;

		const targets = a.targets;
		const values = a.values;
		const calldatas = a.calldatas;
		const description = a.description;
		// A real ProposalCreated always has equal-length, non-empty arrays and a string
		// description. Anything else is malformed — treat as no match.
		if (
			!Array.isArray(targets) ||
			!Array.isArray(values) ||
			!Array.isArray(calldatas) ||
			typeof description !== 'string' ||
			targets.length === 0 ||
			targets.length !== values.length ||
			targets.length !== calldatas.length
		) {
			return null;
		}

		return {
			targets: targets.map((t) => t as `0x${string}`),
			values: values.map((v) => BigInt(v)),
			calldatas: calldatas.map((c) => c as `0x${string}`),
			description,
		};
	}
	return null;
}
