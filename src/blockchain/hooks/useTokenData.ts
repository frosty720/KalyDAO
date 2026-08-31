import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { getKalyscanApiUrl } from './useKalyscanApi';

/**
 * Native-token (KMT) figures from KalyScan's `/v2/stats`. Only what the explorer actually
 * reports is returned — there are NO fabricated fallbacks (the old hook shipped CoinGecko
 * data for the retired pre-relaunch listing plus hardcoded price/ATH/volume constants). Price comes
 * from the V3 subgraph (useKlcPriceV3), not from here.
 */
export interface TokenData {
  /** Native supply in whole tokens, if KalyScan reports `total_supply`; null otherwise. */
  rawTotalSupply: number | null;
  /** Circulating supply in whole tokens, if reported; null otherwise. */
  rawCirculatingSupply: number | null;
  lastUpdated: Date;
}

const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface UseTokenDataOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
}

const toNumber = (v: unknown): number | null => {
  const n = typeof v === 'string' || typeof v === 'number' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Blockscout reports supplies in wei on some versions and whole tokens on others;
// anything absurdly large is wei.
const toWholeTokens = (v: unknown): number | null => {
  const n = toNumber(v);
  return n !== null && n > 1e15 ? n / 1e18 : n;
};

export function useTokenData(options: UseTokenDataOptions = {}): {
  tokenData: TokenData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastRefreshTime: Date | null;
} {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshInterval = options.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
  const autoRefresh = options.autoRefresh ?? true;

  const fetchTokenData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const refreshTime = new Date();
      setLastRefreshTime(refreshTime);
      const { data } = await axios.get<Record<string, unknown>>(`${getKalyscanApiUrl()}/v2/stats`);
      setTokenData({
        rawTotalSupply: toWholeTokens(data?.total_supply),
        rawCirculatingSupply: toWholeTokens(data?.coin_circulating_supply),
        lastUpdated: refreshTime,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenData();
    if (autoRefresh && refreshInterval > 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchTokenData, refreshInterval);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    return undefined;
  }, [fetchTokenData, refreshInterval, autoRefresh]);

  return { tokenData, isLoading, error, refetch: fetchTokenData, lastRefreshTime };
}
