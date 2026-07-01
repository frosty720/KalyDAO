import { encodeFunctionData } from 'viem';

/**
 * A single on-chain action in an OpenZeppelin Governor proposal.
 * `propose(targets[], values[], calldatas[], description)` is built from these.
 */
export interface ProposalAction {
	target: `0x${string}`;
	/** Native value in wei, as a string (form-friendly; converted to BigInt at submit). */
	value: string;
	calldata: `0x${string}`;
}

/** Minimal ABI for the DAOSettings string setter used as the signaling no-op. */
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

export const SIGNALING_CATEGORY = 'signaling';
export const SIGNALING_VALUE = 'passed';

/**
 * Turn a proposal title into a stable, bounded DAOSettings key.
 * Lowercase, non-alphanumerics collapsed to underscores, trimmed, capped.
 */
export const signalingKeyFromTitle = (title: string): string => {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 64);
	return slug ? `signal_${slug}` : 'signal';
};

/**
 * Build the harmless no-op action for a signaling ("vote only") proposal.
 *
 * OpenZeppelin's Governor requires at least one action, so a vote-only proposal
 * still needs *something* on-chain. We write a string to DAOSettings: it is safe
 * to execute (the TimelockController holds TIMELOCK_ROLE on DAOSettings) and has
 * no side effect beyond recording that the signal passed.
 *
 * @param daoSettingsAddress Address of the DAOSettings contract for the active network.
 * @param title              Proposal title, used to derive the settings key.
 */
export const buildSignalingAction = (
	daoSettingsAddress: `0x${string}`,
	title: string,
): ProposalAction => {
	const calldata = encodeFunctionData({
		abi: daoSettingsSignalAbi,
		functionName: 'setStringParameter',
		args: [SIGNALING_CATEGORY, signalingKeyFromTitle(title), SIGNALING_VALUE],
	});

	return {
		target: daoSettingsAddress,
		value: '0',
		calldata,
	};
};

/** True when `addr` is a syntactically valid, non-zero EVM address. */
export const isValidActionTarget = (addr: string): boolean =>
	/^0x[a-fA-F0-9]{40}$/.test(addr) &&
	addr.toLowerCase() !== '0x0000000000000000000000000000000000000000';
