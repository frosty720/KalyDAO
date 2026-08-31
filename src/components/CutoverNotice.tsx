/**
 * First-visit announcement for the KLC → KMT chain cutover. This is the ONE component
 * allowed to name the old KLC ticker (see the allowlist in the migration guard test) —
 * its whole job is telling users the chain moved and getting their wallet onto 3890.
 *
 * Browsers commonly run several wallets at once (Brave's built-in wallet next to
 * MetaMask, say). Grabbing `window.ethereum` sends the request to whichever one won the
 * injection race, so the user approves in one wallet while another silently holds the
 * prompt. We enumerate wallets (EIP-6963) and let the user choose, then VERIFY the
 * resulting chain instead of assuming the request worked.
 */
import { useEffect, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NATIVE_SYMBOL } from '@/blockchain/config/chains';
import {
	connectToKalyChain,
	currentChainId,
	discoverWallets,
	dismissNotice,
	isNoticeDismissed,
	isOnKalyChain,
	WALLET_CHAIN_NAME,
	type WalletChoice,
} from '@/lib/cutoverNotice';

export default function CutoverNotice() {
	const [open, setOpen] = useState(() => !isNoticeDismissed());
	const [wallets, setWallets] = useState<WalletChoice[]>([]);
	const [busyId, setBusyId] = useState('');
	const [error, setError] = useState('');
	const [done, setDone] = useState(false);

	useEffect(() => {
		let live = true;
		discoverWallets().then((found) => {
			if (live) setWallets(found);
		});
		return () => {
			live = false;
		};
	}, []);

	const close = () => {
		dismissNotice();
		setOpen(false);
	};

	const handleConnect = async (wallet: WalletChoice) => {
		setBusyId(wallet.uuid);
		setError('');
		try {
			const result = await connectToKalyChain(wallet.provider);
			if (result === 'cancelled') {
				setError(`Request cancelled in ${wallet.name}. Nothing was changed — you can try again.`);
				return;
			}
			// Never claim success on the request alone: confirm the wallet is actually on the chain.
			if (isOnKalyChain(await currentChainId(wallet.provider))) {
				setDone(true);
				return;
			}
			setError(
				`${wallet.name} accepted the request but is still on another network. Open it and switch to "${WALLET_CHAIN_NAME}" manually.`,
			);
		} catch {
			setError(
				`${wallet.name} could not add the network. If it already has a KalyChain entry using this RPC, remove that old entry first, then try again.`,
			);
		} finally {
			setBusyId('');
		}
	};

	return (
		<Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>KalyChain has moved to a new chain</DialogTitle>
					<DialogDescription className="space-y-2 pt-2 text-left">
						<span className="block">
							KalyChain has relaunched. KLC is now <strong>{NATIVE_SYMBOL}</strong> at a{' '}
							<strong>110&nbsp;:&nbsp;1</strong> ratio (110 KLC → 1 {NATIVE_SYMBOL}), and balances and
							governance positions were migrated automatically.
						</span>
						<span className="block">
							Add the new <strong>{WALLET_CHAIN_NAME}</strong> network to your wallet to continue
							using the DAO.
						</span>
						<span className="block text-xs text-muted-foreground">
							Kaly Wallet (email / social login) users are already on the new network — no action
							needed.
						</span>
					</DialogDescription>
				</DialogHeader>

				{done ? (
					<p className="text-sm font-medium text-[#16a34a]">
						✓ Connected to {WALLET_CHAIN_NAME}. You're on the new chain.
					</p>
				) : (
					<>
						{wallets.length > 1 && (
							<p className="text-xs text-muted-foreground">
								You have more than one wallet installed — pick the one you vote with.
							</p>
						)}
						<div className="flex flex-col gap-2">
							{wallets.map((wallet) => (
								<Button
									key={wallet.uuid}
									onClick={() => handleConnect(wallet)}
									disabled={busyId !== ''}
									className="w-full justify-center gap-2"
								>
									{wallet.icon && (
										<img src={wallet.icon} alt="" className="h-4 w-4 rounded" aria-hidden />
									)}
									{busyId === wallet.uuid ? `Check ${wallet.name}…` : `Add network in ${wallet.name}`}
								</Button>
							))}
						</div>
						{wallets.length === 0 && (
							<p className="text-xs text-muted-foreground">
								No browser wallet detected. If you use Kaly Wallet, you're already set — just
								continue.
							</p>
						)}
					</>
				)}

				{error && <p className="text-sm text-destructive">{error}</p>}

				<DialogFooter>
					<Button variant="outline" onClick={close} className="w-full">
						{done ? 'Close' : 'Continue'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
