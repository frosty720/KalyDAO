import { useEffect, useState } from 'react';

// KLC price from the KalySwap V3 subgraph — the same source kaly-vault uses.
// WKLC is the V3 base token (derivedETH = 1), so KLC price = bundle.ethPriceUSD.
// Env-overridable; defaults to the production V3 subgraph (matches kaly-vault).
const V3_SUBGRAPH_URL =
  import.meta.env.VITE_V3_SUBGRAPH_URL ||
  'https://app.kalyswap.io/subgraphs/name/v3-subgraph-kalychain-mainnet';

// WKLC (V3 base token) — its hourly priceUSD IS the KLC/USD history, used for the
// 24h change so it stays consistent with the displayed price. Env-overridable.
const WKLC_ADDRESS = (
  import.meta.env.VITE_WKLC_ADDRESS || '0x069255299Bb729399f3CECaBdc73d15d3D10a2A3'
).toLowerCase();

export interface KlcPriceV3 {
  /** Live KLC/USD price (bundle.ethPriceUSD). null while loading / unavailable. */
  price: number | null;
  /** Rolling 24h change in %, from the V3 price 24h ago. null if not computable. */
  change24h: number | null;
}

/**
 * Live KLC price + 24h change from the V3 subgraph. Both figures come from the same
 * on-chain KalySwap source, so the % sign always matches the price move (unlike the
 * old CoinGecko feed, which reported a stale/opposite change for KLC).
 */
export function useKlcPriceV3(): KlcPriceV3 {
  const [data, setData] = useState<KlcPriceV3>({ price: null, change24h: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // now-24h, computed here (browser) since the subgraph bundle has no history.
        const target = Math.floor(Date.now() / 1000) - 86_400;
        const query = `{
          bundles(first: 1) { ethPriceUSD }
          tokenHourDatas(first: 48, orderBy: periodStartUnix, orderDirection: desc, where: { token: "${WKLC_ADDRESS}" }) {
            periodStartUnix
            priceUSD
          }
        }`;
        const res = await fetch(V3_SUBGRAPH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: {
            bundles?: { ethPriceUSD: string }[];
            tokenHourDatas?: { periodStartUnix: number; priceUSD: string }[];
          };
        };
        const price = Number(json?.data?.bundles?.[0]?.ethPriceUSD);
        const hours = json?.data?.tokenHourDatas ?? [];
        // Most recent hour at or before 24h ago = the price to compare against.
        const past = hours.find((h) => Number(h.periodStartUnix) <= target);
        const price24hAgo = past ? Number(past.priceUSD) : null;
        const change24h =
          price > 0 && price24hAgo && price24hAgo > 0
            ? ((price - price24hAgo) / price24hAgo) * 100
            : null;
        if (!cancelled) setData({ price: price > 0 ? price : null, change24h });
      } catch {
        if (!cancelled) setData({ price: null, change24h: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
