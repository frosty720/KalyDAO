/**
 * Chain-cutover notice logic (pure; the dialog lives in components/CutoverNotice.tsx).
 *
 * KalyChain relaunched as chain 3890 with native KMT at a 110:1 conversion. Wallets
 * that still hold the old saved KalyChain network entry hit a chainId mismatch once
 * DNS moves the RPC hostname to the new chain, so the notice offers
 * wallet_addEthereumChain. Params are built ONLY from config/chains.ts exports so the
 * cut-day hostname switch stays env-only (the migration guard test enforces this).
 */
import { kalychain, RPC_URL, EXPLORER_URL } from '../blockchain/config/chains';

export const CUTOVER_NOTICE_KEY = 'kmt-cutover-notice-v1';

export type Eip1193Provider = {
	request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export function isNoticeDismissed(): boolean {
	try {
		return localStorage.getItem(CUTOVER_NOTICE_KEY) === 'dismissed';
	} catch {
		return false;
	}
}

export function dismissNotice(): void {
	try {
		localStorage.setItem(CUTOVER_NOTICE_KEY, 'dismissed');
	} catch {
		// Storage unavailable — the notice simply shows again next visit.
	}
}

/** wallet_addEthereumChain params, derived from the single chain config. */
export function addChainParams() {
	return {
		chainId: `0x${kalychain.id.toString(16)}`,
		chainName: kalychain.name,
		nativeCurrency: { ...kalychain.nativeCurrency },
		rpcUrls: [RPC_URL],
		blockExplorerUrls: [EXPLORER_URL],
	};
}

/**
 * Switch the injected wallet to KalyChain (3890). A wallet without the network
 * rejects the switch (EIP-3085 code 4902), so any failure falls back to adding the
 * network, which prompts the user and switches in the same flow.
 */
export async function connectToKalyChain(provider: Eip1193Provider): Promise<'switched' | 'added'> {
	const params = addChainParams();
	try {
		await provider.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: params.chainId }],
		});
		return 'switched';
	} catch {
		await provider.request({ method: 'wallet_addEthereumChain', params: [params] });
		return 'added';
	}
}

/** The injected (MetaMask-style) provider, if any. Kaly Wallet (thirdweb in-app)
 * users need no action — the chain comes from app config. */
export function injectedProvider(): Eip1193Provider | null {
	if (typeof window === 'undefined') return null;
	return (window as { ethereum?: Eip1193Provider }).ethereum ?? null;
}
