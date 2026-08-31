import { describe, it, expect, afterEach, vi } from 'vitest';
import {
	CUTOVER_NOTICE_KEY,
	addChainParams,
	connectToKalyChain,
	dismissNotice,
	isNoticeDismissed,
	isOnKalyChain,
	providerErrorCode,
	discoverWallets,
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
			chainName: 'KalyChain KMT',
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

	it('reports a rejected add as cancelled, not as an error', async () => {
		// A user saying "no" is not a failure to shout about — the dialog offers a retry.
		const provider: Eip1193Provider = {
			request: async () => {
				throw Object.assign(new Error('User rejected'), { code: 4001 });
			},
		};
		await expect(connectToKalyChain(provider)).resolves.toBe('cancelled');
	});

	it('surfaces a genuine add failure (e.g. RPC already used by another network)', async () => {
		const provider: Eip1193Provider = {
			request: async ({ method }) => {
				if (method === 'wallet_switchEthereumChain') {
					throw Object.assign(new Error('unknown'), { code: 4902 });
				}
				throw Object.assign(new Error('RPC URL already in use'), { code: -32602 });
			},
		};
		await expect(connectToKalyChain(provider)).rejects.toThrow('RPC URL already in use');
	});

	it('uses a wallet-facing name distinct from the bare chain name, so a new entry is visible', () => {
		// Users migrating still have an old "KalyChain" network saved; an identically named
		// entry is invisible in the wallet list and they cannot tell it was added.
		expect(addChainParams().chainName).toBe('KalyChain KMT');
		expect(addChainParams().chainName).not.toBe('KalyChain');
	});

	it('user rejection (4001) cancels instead of firing a second prompt', async () => {
		const calls: string[] = [];
		const provider: Eip1193Provider = {
			request: async ({ method }) => {
				calls.push(method);
				throw Object.assign(new Error('rejected'), { code: 4001 });
			},
		};
		await expect(connectToKalyChain(provider)).resolves.toBe('cancelled');
		expect(calls).toEqual(['wallet_switchEthereumChain']);
	});

	it('unknown chain (4902) falls back to add', async () => {
		const calls: string[] = [];
		const provider: Eip1193Provider = {
			request: async ({ method }) => {
				calls.push(method);
				if (method === 'wallet_switchEthereumChain') {
					throw Object.assign(new Error('unknown'), { code: 4902 });
				}
				return null;
			},
		};
		await expect(connectToKalyChain(provider)).resolves.toBe('added');
		expect(calls).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain']);
	});

	it('reads nested provider error codes', () => {
		expect(providerErrorCode({ code: 4001 })).toBe(4001);
		expect(providerErrorCode({ data: { originalError: { code: 4902 } } })).toBe(4902);
		expect(providerErrorCode(new Error('plain'))).toBeUndefined();
	});

	it('verifies the wallet actually landed on KalyChain', () => {
		expect(isOnKalyChain('0xf32')).toBe(true);
		expect(isOnKalyChain('0x1')).toBe(false);
		expect(isOnKalyChain(null)).toBe(false);
	});

	it('discovers multiple wallets via EIP-6963 so the request is not sent to the wrong one', async () => {
		const listeners: Array<(e: Event) => void> = [];
		const make = (uuid: string, name: string) => ({
			info: { uuid, name },
			provider: { request: async () => null } as Eip1193Provider,
		});
		vi.stubGlobal('window', {
			addEventListener: (_t: string, fn: (e: Event) => void) => listeners.push(fn),
			removeEventListener: () => {},
			dispatchEvent: () => {
				for (const fn of listeners) {
					fn({ detail: make('a', 'MetaMask') } as unknown as Event);
					fn({ detail: make('b', 'Brave Wallet') } as unknown as Event);
				}
				return true;
			},
			setTimeout: (fn: () => void) => {
				fn();
				return 0;
			},
		});
		const found = await discoverWallets(0);
		expect(found.map((w) => w.name).sort()).toEqual(['Brave Wallet', 'MetaMask']);
	});
});
