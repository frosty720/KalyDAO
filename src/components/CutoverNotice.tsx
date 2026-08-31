/**
 * First-visit announcement for the KLC → KMT chain cutover. This is the ONE component
 * allowed to name the old KLC ticker (see the allowlist in the migration guard test) —
 * its whole job is telling users the chain moved and getting their wallet onto 3890.
 */
import { useState } from 'react';
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
	dismissNotice,
	injectedProvider,
	isNoticeDismissed,
} from '@/lib/cutoverNotice';

export default function CutoverNotice() {
	const [open, setOpen] = useState(() => !isNoticeDismissed());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const provider = injectedProvider();

	const close = () => {
		dismissNotice();
		setOpen(false);
	};

	const handleConnect = async () => {
		if (!provider) return;
		setBusy(true);
		setError('');
		try {
			await connectToKalyChain(provider);
			close();
		} catch {
			setError('Your wallet declined the request. You can try again, or add the network later from your wallet settings.');
		} finally {
			setBusy(false);
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
							Connect your wallet to the new KalyChain network to continue using the DAO.
						</span>
						<span className="block text-xs text-muted-foreground">
							Kaly Wallet (email / social login) users are already on the new network — no action
							needed.
						</span>
					</DialogDescription>
				</DialogHeader>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={close}>
						Continue
					</Button>
					{provider && (
						<Button onClick={handleConnect} disabled={busy}>
							{busy ? 'Check your wallet…' : 'Connect to the new network'}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
