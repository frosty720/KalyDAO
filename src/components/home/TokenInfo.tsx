import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Separator } from "../ui/separator";
import { Coins, TrendingUp, Loader2 } from "lucide-react";
import { useTokenData } from "../../blockchain/hooks/useTokenData";
import { useKlcPriceV3 } from "../../blockchain/hooks/useKlcPriceV3";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

// KMT has no fixed max supply, so we show absolute figures (no "/ cap").
const fmtNum = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(2)}K` : String(Math.round(n));
const fmtUsd = (n: number) =>
  `$${n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(2)}K` : n.toFixed(2)}`;

const TokenInfo = () => {
  const { tokenData, isLoading, error, refetch } = useTokenData();
  const { price: v3Price, change24h } = useKlcPriceV3(); // price + 24h change from the V3 subgraph

  if (isLoading) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            KMT Token Information
          </CardTitle>
          <CardDescription>
            Loading token data from the blockchain...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            KMT Token Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Error loading token data: {error.message}
              <Button 
                onClick={refetch} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!tokenData) {
    return null;
  }

  const { rawTotalSupply, rawCirculatingSupply } = tokenData;

  // Every figure is a live read or "—": supply from KalyScan, price + 24h change + market
  // cap from the V3 subgraph. Nothing here is estimated.
  const supplyDisplay = rawTotalSupply != null ? `${fmtNum(rawTotalSupply)} KMT` : '—';
  const priceDisplay = v3Price != null ? `$${v3Price.toFixed(6)}` : '—';
  const supplyForCap = rawCirculatingSupply ?? rawTotalSupply;
  const marketCapDisplay = v3Price != null && supplyForCap != null ? fmtUsd(v3Price * supplyForCap) : '—';
  const changePct = change24h;
  const changePositive = (changePct ?? 0) >= 0;

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" />
          KMT Token Information
        </CardTitle>
        <CardDescription>
          Key metrics and information about the KalyChain governance token
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Supply
            </div>
            <div className="text-lg font-bold">{supplyDisplay}</div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Current Price
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-bold mr-2">{priceDisplay}</span>
              {changePct != null && (
                <span
                  className={`text-sm font-medium flex items-center ${changePositive ? "text-green-500" : "text-red-500"}`}
                >
                  {changePositive ? "+" : "-"}
                  {Math.abs(changePct).toFixed(2)}%
                  <TrendingUp className={`h-4 w-4 ml-1 ${changePositive ? "" : "rotate-180"}`} />
                  <span className="ml-1 bg-green-100 text-green-800 text-xs px-1 rounded-full">live</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Market Cap
            </div>
            <div className="text-2xl font-bold">{marketCapDisplay}</div>
          </div>

        </div>

        <Separator className="my-4" />

        <div className="pt-2">
          <span className="text-sm text-muted-foreground">
            Price + 24h change via the KalySwap V3 subgraph · supply from KalyScan · no estimates
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenInfo;
