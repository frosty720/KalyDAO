/**
 * Decision logic for the proposal lifecycle panel.
 *
 * After a proposal PASSES it does not auto-apply: someone must Queue it (starting
 * the timelock), wait the timelock delay, then Execute it. This module turns the
 * on-chain ProposalState (+ the queued eta) into a single "what needs doing now"
 * descriptor the UI can render. Kept pure so the rules are unit-testable.
 *
 * OpenZeppelin Governor ProposalState enum (v4.x):
 * 0 Pending, 1 Active, 2 Canceled, 3 Defeated, 4 Succeeded, 5 Queued, 6 Expired, 7 Executed
 *
 * Note: this deployment uses GovernorTimelockControl + OZ TimelockController,
 * which has NO grace period — a queued proposal never expires and stays
 * executable forever once the delay passes.
 */

export type LifecyclePhase =
	| 'pending'
	| 'active'
	| 'defeated'
	| 'canceled'
	| 'succeeded'
	| 'queued-waiting'
	| 'queued-ready'
	| 'executed'
	| 'expired'
	| 'unknown';

export interface LifecycleStep {
	phase: LifecyclePhase;
	/** True when a human needs to take an action now (queue or execute). */
	actionRequired: boolean;
	/** The on-chain action the CTA should trigger, if any. */
	cta: 'queue' | 'execute' | null;
	title: string;
	description: string;
	/** Seconds until execution becomes available (only for 'queued-waiting'). */
	secondsUntilExecutable?: number;
}

export interface LifecycleInput {
	/** OZ ProposalState index. */
	state: number;
	/** Unix seconds when the queued proposal becomes executable (Queued only). */
	proposalEta?: number;
	/** Current time in unix seconds. */
	nowSeconds: number;
}

export const getProposalLifecycleStep = ({
	state,
	proposalEta,
	nowSeconds,
}: LifecycleInput): LifecycleStep => {
	switch (state) {
		case 0:
			return {
				phase: 'pending',
				actionRequired: false,
				cta: null,
				title: 'Pending',
				description: 'Voting has not started yet. Check back once the voting delay passes.',
			};
		case 1:
			return {
				phase: 'active',
				actionRequired: false,
				cta: null,
				title: 'Voting is open',
				description: 'Cast your vote before the voting period ends.',
			};
		case 2:
			return {
				phase: 'canceled',
				actionRequired: false,
				cta: null,
				title: 'Canceled',
				description: 'This proposal was canceled and cannot proceed.',
			};
		case 3:
			return {
				phase: 'defeated',
				actionRequired: false,
				cta: null,
				title: 'Defeated',
				description: 'This proposal did not pass. No further action is possible.',
			};
		case 4:
			return {
				phase: 'succeeded',
				actionRequired: true,
				cta: 'queue',
				title: 'Passed — needs to be queued',
				description:
					'The vote passed. Queue the proposal to start the timelock delay before it can be executed.',
			};
		case 5: {
			// Queued: waiting on the timelock, or ready to execute.
			if (proposalEta !== undefined && nowSeconds < proposalEta) {
				return {
					phase: 'queued-waiting',
					actionRequired: false,
					cta: null,
					title: 'Queued — waiting on timelock',
					description: 'Execution becomes available once the timelock delay passes.',
					secondsUntilExecutable: Math.max(0, Math.ceil(proposalEta - nowSeconds)),
				};
			}
			return {
				phase: 'queued-ready',
				actionRequired: true,
				cta: 'execute',
				title: 'Ready to execute',
				description:
					'The timelock has passed. Execute the proposal to apply it on-chain. It will not expire, so this can be done anytime.',
			};
		}
		case 6:
			return {
				phase: 'expired',
				actionRequired: false,
				cta: null,
				title: 'Expired',
				description: 'This proposal expired before it was executed.',
			};
		case 7:
			return {
				phase: 'executed',
				actionRequired: false,
				cta: null,
				title: 'Executed',
				description: 'This proposal has been executed on-chain.',
			};
		default:
			return {
				phase: 'unknown',
				actionRequired: false,
				cta: null,
				title: 'Unknown',
				description: 'Could not determine the proposal state.',
			};
	}
};
