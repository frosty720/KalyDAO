import { describe, it, expect, afterEach, vi } from 'vitest';
import {
	CUTOVER_NOTICE_KEY,
	addChainParams,
	connectToKalyChain,
	dismissNotice,
	isNoticeDismissed,
	type Eip1193Provider,
} from './cutoverNotice';
import { KALYCHAIN_CHAIN_ID, RPC_URL, EXPLORER_URL } from '../blockchain/config/chains';

function stubStorage() {
	const store = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, v);
		},
	});
	return store;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('cutoverNotice', () => {
	it('builds wallet_addEthereumChain params from the single chain config', () => {
		expect(addChainParams()).toEqual({
			chainId: `0x${KALYCHAIN_CHAIN_ID.toString(16)}`,
			chainName: 'KalyChain',
			nativeCurrency: { name: 'KalyChain Monetary Token', symbol: 'KMT', decimals: 18 },
			rpcUrls: [RPC_URL],
			blockExplorerUrls: [EXPLORER_URL],
		});
		expect(addChainParams().chainId).toBe('0xf32');
	});

	it('dismissal persists via localStorage', () => {
		const store = stubStorage();
		expect(isNoticeDismissed()).toBe(false);
		dismissNotice();
		expect(store.get(CUTOVER_NOTICE_KEY)).toBe('dismissed');
		expect(isNoticeDismissed()).toBe(true);
	});

	it('survives missing/throwing storage (shows again instead of crashing)', () => {
		// No localStorage stubbed at all in this test.
		expect(isNoticeDismissed()).toBe(false);
		expect(() => dismissNotice()).not.toThrow();
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
		});
		expect(isNoticeDismissed()).toBe(false);
		expect(() => dismissNotice()).not.toThrow();
	});

	it('switches when the wallet already knows the chain', async () => {
		const calls: string[] = [];
		const provider: Eip1193Provider = {
			request: async ({ method }) => {
				calls.push(method);
				return null;
			},
		};
		await expect(connectToKalyChain(provider)).resolves.toBe('switched');
		expect(calls).toEqual(['wallet_switchEthereumChain']);
	});

	it('falls back to adding the network when the switch is rejected (4902)', async () => {
		const calls: { method: string; params?: unknown[] }[] = [];
		const provider: Eip1193Provider = {
			request: async (args) => {
				calls.push(args);
				if (args.method === 'wallet_switchEthereumChain') {
					throw Object.assign(new Error('Unrecognized chain ID'), { code: 4902 });
				}
				return null;
			},
		};
		await expect(connectToKalyChain(provider)).resolves.toBe('added');
		expect(calls.map((c) => c.method)).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain']);
		expect(calls[1].params).toEqual([addChainParams()]);
	});

	it('propagates a rejection of the add itself (user said no)', async () => {
		const provider: Eip1193Provider = {
			request: async () => {
				throw Object.assign(new Error('User rejected'), { code: 4001 });
			},
		};
		await expect(connectToKalyChain(provider)).rejects.toThrow('User rejected');
	});
});
