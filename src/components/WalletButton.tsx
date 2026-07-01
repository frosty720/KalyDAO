import { ConnectButton, darkTheme, useActiveWalletChain } from 'thirdweb/react';
import {
  thirdwebClient,
  thirdwebChains,
  twActiveChain,
  allWallets,
  SUPPORTED_TOKENS,
} from '@/blockchain/config/thirdweb';

// Brand the thirdweb modal + button to the kaly-vault amber-on-black system.
const daoTheme = darkTheme({
  colors: {
    modalBg: '#0a0a0a',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    accentText: '#f59e0b',
    accentButtonBg: '#f59e0b',
    accentButtonText: '#0a0a0a',
    primaryButtonBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    primaryButtonText: '#ffffff',
    secondaryButtonBg: 'rgba(255,255,255,0.06)',
    primaryText: '#ffffff',
    secondaryText: '#a8a29e',
  },
});

/**
 * Shared connect/account button (thirdweb in-app wallet). `compact` renders a
 * tighter modal (used in the header); the default is used for standalone prompts.
 */
export function WalletButton({
  compact = false,
  label = 'Connect Wallet',
}: {
  compact?: boolean;
  label?: string;
}) {
  // The DAO is multi-network. Follow the wallet's ACTIVE chain so the button never
  // forces a "Switch Network" back to mainnet when the user is on testnet. New
  // connections (no active chain yet) default to mainnet. Both chains stay available
  // in the account modal's network switcher via `chains`.
  const activeChain = useActiveWalletChain();
  return (
    <ConnectButton
      client={thirdwebClient}
      wallets={allWallets}
      chains={thirdwebChains}
      chain={activeChain ?? twActiveChain}
      supportedTokens={SUPPORTED_TOKENS}
      theme={daoTheme}
      connectButton={{
        label,
        // Match the app's primary buttons (h-11 / 44px) so it lines up next to them.
        style: {
          height: '2.75rem',
          minHeight: '2.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
        },
      }}
      connectModal={{
        title: 'Connect to KalyChain DAO',
        size: compact ? 'compact' : 'wide',
        showThirdwebBranding: false,
      }}
    />
  );
}

export default WalletButton;
