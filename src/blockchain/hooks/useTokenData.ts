import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getKalyscanApiUrl } from './useKalyscanApi';

export interface TokenData {
  totalSupply: string;
  circulatingSupply: string;
  currentPrice: string;
  marketCap: string;
  governancePower?: number;
  priceChange: {
    value: number;
    isPositive: boolean;
  };
  volume24h?: string;
  allTimeHigh?: string;
  allTimeLow?: string;
  // Raw values for calculations
  rawTotalSupply: number;
  rawCirculatingSupply: number;
  lastUpdated: Date;
}

// KLC Token constants based on CMC data
const KLC_MAX_SUPPLY = 7000000000; // 7 billion
const KLC_DEFAULT_CIRCULATING = 3570000000; // 3.57 billion from CMC
const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper function to format large numbers
const formatNumber = (num: number, decimals = 2): string => {
  if (num >= 1000000000) {
    return `$${(num / 1000000000).toFixed(decimals)}B`;
  } else if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(decimals)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(decimals)}K`;
  } else {
    return `$${num.toFixed(decimals)}`;
  }
};

// Helper function to format token amounts in more readable units
const formatTokenAmount = (amount: number): string => {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2)}B KLC`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M KLC`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}K KLC`;
  } else {
    return `${amount.toFixed(2)} KLC`;
  }
};

interface UseTokenDataOptions {
  refreshInterval?: number;  // Refresh interval in milliseconds
  autoRefresh?: boolean;     // Whether to automatically refresh
}

export function useTokenData(
  isTestnet = false,
  options: UseTokenDataOptions = {}
): {
  tokenData: TokenData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastRefreshTime: Date | null;
} {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  
  // Set default options
  const { 
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    autoRefresh = true
  } = options;
  
  // Use a ref to store the interval ID so it persists across renders
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchTokenData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Set the last refresh time
      const refreshTime = new Date();
      setLastRefreshTime(refreshTime);
      
      // Base URL for API calls
      const baseUrl = getKalyscanApiUrl(isTestnet);
      
      console.log(`Fetching token data from: ${baseUrl}/v2/stats at ${refreshTime.toLocaleTimeString()}`);

      // Initialize variables for API data with fallback values
      let statsData = {};
      let circulatingFromTokenInfo = null;

      // Try to fetch on-chain stats from KalyScan API with error handling
      try {
        const statsResponse = await axios.get(`${baseUrl}/v2/stats`);
        console.log("Stats API response:", statsResponse.data);
        statsData = statsResponse.data || {};
      } catch (err) {
        console.warn("Could not fetch stats from KalyScan API, using fallback data:", err);
        // Continue with empty statsData, will use fallback values below
      }

      // Try to get circulating supply directly from token info
      try {
        const tokenResponse = await axios.get(`${baseUrl}/v2/tokens`);
        console.log("Token API response:", tokenResponse.data);

        // Look for KLC token in the tokens list
        if (Array.isArray(tokenResponse.data)) {
          const klcToken = tokenResponse.data.find((token: any) =>
            token.symbol === 'KLC' || token.name === 'KalyChain'
          );

          if (klcToken && klcToken.circulating_supply) {
            circulatingFromTokenInfo = Number(klcToken.circulating_supply);
            console.log(`Found circulating supply from token info: ${circulatingFromTokenInfo}`);
          }
        }
      } catch (err) {
        console.warn("Could not fetch token info for circulating supply:", err);
      }
      
      // Try to fetch live data from CoinGecko API
      let coinGeckoPrice = 0.001214; // Default fallback price
      let cmcPriceChange = 0.08; // Default fallback
      let cmcVolume = 40070; // Default fallback
      let cmcAtl = 0.001203; // Default fallback
      let cmcAth = 0.5844; // Default fallback

      try {
        // Fetch live data from CoinGecko API
        const coinGeckoUrl = 'https://api.coingecko.com/api/v3/coins/kalycoin';
        const coinGeckoResponse = await axios.get(coinGeckoUrl);

        if (coinGeckoResponse.data && coinGeckoResponse.data.market_data) {
          const marketData = coinGeckoResponse.data.market_data;

          // Get current price (MOST IMPORTANT!)
          if (marketData.current_price && marketData.current_price.usd) {
            coinGeckoPrice = marketData.current_price.usd;
            console.log(`✅ Successfully fetched live CoinGecko price: $${coinGeckoPrice}`);
          } else {
            console.warn('❌ CoinGecko API did not return current_price, using fallback value');
          }

          // Get 24h price change percentage
          if (marketData.price_change_percentage_24h !== undefined) {
            cmcPriceChange = marketData.price_change_percentage_24h;
            console.log(`✅ Successfully fetched live price change: ${cmcPriceChange}%`);
          } else {
            console.warn('❌ CoinGecko API did not return price_change_percentage_24h, using fallback value');
          }

          // Get 24h volume
          if (marketData.total_volume && marketData.total_volume.usd) {
            cmcVolume = marketData.total_volume.usd;
            console.log(`✅ Got CoinGecko volume: $${cmcVolume}`);
          }

          // Get ATH and ATL if available
          if (marketData.ath && marketData.ath.usd) {
            cmcAth = marketData.ath.usd;
            console.log(`✅ Got ATH: $${cmcAth}`);
          }

          if (marketData.atl && marketData.atl.usd) {
            cmcAtl = marketData.atl.usd;
            console.log(`✅ Got ATL: $${cmcAtl}`);
          }
        }
      } catch (err) {
        console.warn("Could not fetch CoinGecko data, using fallback values:", err);
      }

      // CoinGecko data for KalyChain (from https://www.coingecko.com/en/coins/kalycoin)
      const coinGeckoData = {
        price_change_24h_percent: cmcPriceChange, // Use the dynamically fetched value
        volume_24h: cmcVolume,
        ath: cmcAth,
        atl: cmcAtl,
        current_price: coinGeckoPrice // Use live CoinGecko price
      };
      
      // Extract data from the API response (statsData was already initialized above)
      const coin_price = (statsData as any).coin_price;
      const coin_market_cap = (statsData as any).coin_market_cap;
      const coin_circulating_supply = (statsData as any).coin_circulating_supply;
      const totalSupplyValue = (statsData as any).total_supply;
      
      console.log(`API coin_price: ${coin_price}`);
      console.log(`API coin_market_cap: ${coin_market_cap}`);
      console.log(`API coin_circulating_supply: ${coin_circulating_supply}`);
      
      // Extract and format data
      // Use API data for total supply if available, else fallback to CMC data
      const actualTotalSupply = totalSupplyValue 
        ? Number(totalSupplyValue) 
        : KLC_DEFAULT_CIRCULATING;
        
      // Format total supply in a more concise way
      const totalSupply = formatTokenAmount(actualTotalSupply) + ` / ${formatTokenAmount(KLC_MAX_SUPPLY)}`;
      
      // Try to get circulating supply from multiple sources in order of preference:
      // 1. Token info endpoint
      // 2. Stats endpoint
      // 3. CMC fallback value
      const actualCirculatingSupply = circulatingFromTokenInfo 
        ? circulatingFromTokenInfo 
        : coin_circulating_supply 
          ? Number(coin_circulating_supply) 
          : KLC_DEFAULT_CIRCULATING;
          
      const circulatingSupply = formatTokenAmount(actualCirculatingSupply);
      
      console.log(`Total supply: ${actualTotalSupply}, Circulating: ${actualCirculatingSupply}`);
      
      // Get price with priority: CoinGecko > KalyScan API > Fallback
      let priceValue: number;
      let currentPrice: string;

      // Priority 1: Use CoinGecko price (most reliable)
      if (coinGeckoPrice && coinGeckoPrice > 0) {
        priceValue = coinGeckoPrice;
        console.log(`✅ Using CoinGecko live price: $${priceValue}`);
      }
      // Priority 2: Try KalyScan API if CoinGecko failed
      else if (coin_price && coin_price !== "0" && coin_price !== "0.0") {
        priceValue = Number(coin_price);
        console.log(`Using KalyScan API price: $${priceValue}`);
      }
      // Priority 3: Use fallback
      else {
        priceValue = coinGeckoData.current_price;
        console.log(`⚠️ Using fallback price: $${priceValue}`);
      }

      // Format price based on value
      if (priceValue < 0.1) {
        currentPrice = `$${priceValue.toFixed(6)}`;
      } else if (priceValue < 1) {
        currentPrice = `$${priceValue.toFixed(4)}`;
      } else {
        currentPrice = `$${priceValue.toFixed(2)}`;
      }

      console.log(`Final formatted price: ${currentPrice}`);
      
      // Calculate market cap using price * circulating supply if not available from API
      let marketCapValue: number;
      
      if (coin_market_cap && coin_market_cap !== "0" && coin_market_cap !== "0.000000000") {
        marketCapValue = Number(coin_market_cap);
        console.log(`Using API market cap: ${marketCapValue}`);
      } else {
        // Calculate market cap using price * circulating supply
        marketCapValue = priceValue * actualCirculatingSupply;
        console.log(`Calculated market cap: ${marketCapValue} (${priceValue} * ${actualCirculatingSupply})`);
      }
      
      const marketCap = formatNumber(marketCapValue);
      console.log(`Formatted market cap: ${marketCap}`);

      // Use percentage change from CoinGecko - use the dynamically fetched value
      const percentChange = coinGeckoData.price_change_24h_percent;
      const isPositive = percentChange >= 0;

      console.log(`📊 Setting price change value: ${percentChange}%, isPositive: ${isPositive}`);

      // Update token data with all processed values
      setTokenData({
        totalSupply,
        circulatingSupply,
        currentPrice,
        marketCap,
        governancePower: 65, // This might come from a governance contract
        priceChange: {
          value: Math.abs(percentChange),
          isPositive
        },
        volume24h: formatNumber(coinGeckoData.volume_24h),
        allTimeHigh: `$${coinGeckoData.ath.toFixed(4)}`,
        allTimeLow: `$${coinGeckoData.atl.toFixed(6)}`,
        rawTotalSupply: actualTotalSupply,
        rawCirculatingSupply: actualCirculatingSupply,
        lastUpdated: refreshTime
      });
      
    } catch (err) {
      console.error("Error fetching token data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Set up the refresh interval
  useEffect(() => {
    // Initial fetch
    fetchTokenData();
    
    // Set up interval for automatic refresh if enabled
    if (autoRefresh && refreshInterval > 0) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Create new interval
      intervalRef.current = setInterval(() => {
        console.log(`Auto-refreshing token data (interval: ${refreshInterval / 1000}s)`);
        fetchTokenData();
      }, refreshInterval);
      
      // Return cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    
    return undefined;
  }, [isTestnet, refreshInterval, autoRefresh]);

  return { 
    tokenData, 
    isLoading, 
    error, 
    refetch: fetchTokenData,
    lastRefreshTime
  };
} 