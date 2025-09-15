import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { ArrowUpRight, Coins, TrendingUp, Users, Loader2 } from "lucide-react";
import { useTokenData } from "../../blockchain/hooks/useTokenData";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

const MAX_SUPPLY = 7000000000; // 7 billion KLC

const TokenInfo = () => {
  const { tokenData, isLoading, error, refetch } = useTokenData(false); // true for testnet, false for mainnet

  // Calculate circulating percentage directly using raw values
  const circulatingPercentage = useMemo(() => {
    if (!tokenData) return 51; // Default from CMC (3.57B / 7B ≈ 51%)
    return Math.round((tokenData.rawCirculatingSupply / MAX_SUPPLY) * 100);
  }, [tokenData]);

  if (isLoading) {
    return (
      <Card className="w-full bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            KLC Token Information
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
      <Card className="w-full bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            KLC Token Information
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

  const {
    totalSupply = "10B / 7B KLC",
    currentPrice = "$2.45",
    marketCap = "$24,500,000",
    governancePower = 65,
    priceChange = { value: 5.2, isPositive: true },
    volume24h = "$40,070",
  } = tokenData;

  return (
    <Card className="w-full bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" />
          KLC Token Information
        </CardTitle>
        <CardDescription>
          Key metrics and information about the KalyChain governance token
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Supply
            </div>
            <div className="text-lg font-bold">{totalSupply}</div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Current Price
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-bold mr-2">{currentPrice}</span>
              <span
                className={`text-sm font-medium flex items-center ${priceChange.isPositive ? "text-green-500" : "text-red-500"}`}
              >
                {priceChange.isPositive ? "+" : "-"}
                {(priceChange.value).toFixed(2)}%
                <TrendingUp className="h-4 w-4 ml-1" />
                <span className="ml-1 bg-green-100 text-green-800 text-xs px-1 rounded-full">live</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Market Cap
            </div>
            <div className="text-2xl font-bold">{marketCap}</div>
          </div>

          <div className="p-4 rounded-lg border bg-background">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              24h Volume
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{volume24h}</span>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Token Distribution</span>
              <span className="text-sm text-muted-foreground">
                {circulatingPercentage}% of Max Supply
              </span>
            </div>
            <Progress value={circulatingPercentage} className="h-2" />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-muted-foreground">
              Data from KalyScan API
            </span>
            <Link
              to="/token"
              className="text-sm font-medium text-primary flex items-center"
            >
              View Details
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenInfo;
