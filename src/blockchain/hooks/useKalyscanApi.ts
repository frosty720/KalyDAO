import { EXPLORER_API_URL } from '../config/chains';

/** KalyScan (Blockscout) REST base for KalyChain 3890 — env-driven via VITE_EXPLORER_URL. */
export const getKalyscanApiUrl = (): string => EXPLORER_API_URL;
