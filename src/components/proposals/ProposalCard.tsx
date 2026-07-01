import React from "react";
import { Link } from "react-router-dom";
import { Clock, ThumbsUp, ThumbsDown, MinusCircle, Users } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface ProposalCardProps {
  id: string;
  title: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotes: number;
  timeRemaining: string;
  status: "active" | "passed" | "failed" | "pending" | "queued" | "executed";
}

const ProposalCard = ({
  id = "proposal-1",
  title = "Increase Developer Fund Allocation",
  description = "Proposal to increase the allocation of funds for the developer ecosystem by 5% to attract more builders to KalyChain.",
  votesFor = 1250000,
  votesAgainst = 450000,
  votesAbstain = 300000,
  totalVotes = 2000000,
  timeRemaining = "2 days 4 hours",
  status = "active",
}: ProposalCardProps) => {
  // Calculate voting percentages
  const forPercentage = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;
  const againstPercentage = totalVotes > 0 ? Math.round((votesAgainst / totalVotes) * 100) : 0;
  const abstainPercentage = totalVotes > 0 ? Math.round((votesAbstain / totalVotes) * 100) : 0;

  // Format vote numbers
  const formatNumber = (num: number) => {
    return num >= 1000000
      ? `${(num / 1000000).toFixed(1)}M`
      : num >= 1000
        ? `${(num / 1000).toFixed(1)}K`
        : num.toString();
  };

  // If the deadline has passed, voting is closed regardless of the (often stale)
  // stored status — prevents an "Active" badge sitting next to an "Ended" timer.
  const votingClosed = timeRemaining === "Ended";
  const displayStatus =
    votingClosed && (status === "active" || status === "pending") ? "closed" : status;
  const statusLabel =
    displayStatus === "closed"
      ? "Closed"
      : displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

  // Status badge color
  const getStatusColor = () => {
    switch (displayStatus) {
      case "active":
        return "bg-blue-100 text-blue-800";
      case "passed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "queued":
        return "bg-purple-100 text-purple-800";
      case "executed":
        return "bg-teal-100 text-teal-800";
      default:
        return "bg-secondary text-foreground";
    }
  };

  return (
    <Card className="w-full max-w-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
          >
            {statusLabel}
          </span>
        </div>
        <CardDescription className="mt-2 line-clamp-2">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Voting progress */}
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                <span>
                  {formatNumber(votesFor)} ({forPercentage}%)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="h-4 w-4 text-red-600" />
                <span>
                  {formatNumber(votesAgainst)} ({againstPercentage}%)
                </span>
              </div>
            </div>
            <Progress value={forPercentage} className="h-2" />
            
            {/* Add abstain votes if present */}
            {votesAbstain > 0 && (
              <div className="flex justify-end mt-1 text-sm">
                <div className="flex items-center gap-1">
                  <MinusCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatNumber(votesAbstain)} ({abstainPercentage}%) Abstain
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Time and participation */}
          <div className="flex justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{timeRemaining}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{formatNumber(totalVotes)} votes</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4">
        <Link to={`/proposals/${id}`} className="w-full">
          <Button variant="outline" className="w-full">
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default ProposalCard;
