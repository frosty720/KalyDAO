import { describe, it, expect } from 'vitest';
import { getProposalLifecycleStep } from './proposalLifecycle';

const NOW = 1_700_000_000;

describe('getProposalLifecycleStep', () => {
	it('pending: no action', () => {
		const s = getProposalLifecycleStep({ state: 0, nowSeconds: NOW });
		expect(s.phase).toBe('pending');
		expect(s.actionRequired).toBe(false);
		expect(s.cta).toBeNull();
	});

	it('active: no queue/execute action', () => {
		const s = getProposalLifecycleStep({ state: 1, nowSeconds: NOW });
		expect(s.phase).toBe('active');
		expect(s.cta).toBeNull();
	});

	it('defeated and canceled: terminal, no action', () => {
		expect(getProposalLifecycleStep({ state: 2, nowSeconds: NOW }).phase).toBe('canceled');
		expect(getProposalLifecycleStep({ state: 3, nowSeconds: NOW }).actionRequired).toBe(false);
	});

	it('succeeded: action required, cta=queue', () => {
		const s = getProposalLifecycleStep({ state: 4, nowSeconds: NOW });
		expect(s.phase).toBe('succeeded');
		expect(s.actionRequired).toBe(true);
		expect(s.cta).toBe('queue');
	});

	it('queued before eta: waiting, no action, reports countdown', () => {
		const s = getProposalLifecycleStep({ state: 5, proposalEta: NOW + 3600, nowSeconds: NOW });
		expect(s.phase).toBe('queued-waiting');
		expect(s.actionRequired).toBe(false);
		expect(s.cta).toBeNull();
		expect(s.secondsUntilExecutable).toBe(3600);
	});

	it('queued after eta: ready, cta=execute', () => {
		const s = getProposalLifecycleStep({ state: 5, proposalEta: NOW - 1, nowSeconds: NOW });
		expect(s.phase).toBe('queued-ready');
		expect(s.actionRequired).toBe(true);
		expect(s.cta).toBe('execute');
	});

	it('queued at exactly eta: ready to execute', () => {
		const s = getProposalLifecycleStep({ state: 5, proposalEta: NOW, nowSeconds: NOW });
		expect(s.phase).toBe('queued-ready');
		expect(s.cta).toBe('execute');
	});

	it('queued with unknown eta: treated as ready (eta undefined)', () => {
		const s = getProposalLifecycleStep({ state: 5, nowSeconds: NOW });
		expect(s.phase).toBe('queued-ready');
	});

	it('executed: terminal done', () => {
		const s = getProposalLifecycleStep({ state: 7, nowSeconds: NOW });
		expect(s.phase).toBe('executed');
		expect(s.actionRequired).toBe(false);
	});

	it('unknown/NaN state: safe fallback', () => {
		expect(getProposalLifecycleStep({ state: 99, nowSeconds: NOW }).phase).toBe('unknown');
		expect(getProposalLifecycleStep({ state: NaN, nowSeconds: NOW }).phase).toBe('unknown');
	});
});
