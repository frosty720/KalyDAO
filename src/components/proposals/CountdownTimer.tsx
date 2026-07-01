import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetBlock?: number;      // Make optional
  currentBlock?: number;     // Make optional
  targetTimestamp?: number;  // Add target timestamp (seconds)
  averageBlockTime?: number; // in seconds
  type?: 'badge' | 'detail';
  label?: string; // Add label prop for flexibility
}

interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const CountdownTimer = ({
  targetBlock,
  currentBlock,
  targetTimestamp,
  averageBlockTime = 2, // KalyChain average block time is 2 seconds
  type = 'detail',
  label = "Voting starts in:" // Default label
}: CountdownTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeParts | null>(null);

  // Absolute target time (ms epoch). We anchor it ONCE per target and then tick off
  // the wall clock every second. Block-based countdowns used to recompute from
  // (targetBlock - currentBlock) each tick, and since currentBlock only advances
  // ~every 2s the display jumped by 2s instead of ticking down smoothly.
  const anchorRef = useRef<{ key: string; targetMs: number } | null>(null);

  useEffect(() => {
    if (targetTimestamp) {
      anchorRef.current = { key: `ts:${targetTimestamp}`, targetMs: targetTimestamp * 1000 };
      return;
    }
    if (targetBlock != null && currentBlock != null) {
      const key = `blk:${targetBlock}`;
      // Anchor only when the target changes — not on every new block — so the
      // estimate stays stable and the seconds tick down one at a time.
      if (!anchorRef.current || anchorRef.current.key !== key) {
        const blocksRemaining = Number(targetBlock) - Number(currentBlock);
        anchorRef.current = {
          key,
          targetMs: Date.now() + blocksRemaining * averageBlockTime * 1000,
        };
      }
    }
  }, [targetBlock, currentBlock, targetTimestamp, averageBlockTime]);

  useEffect(() => {
    const tick = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        setTimeRemaining(null);
        return;
      }
      const totalSeconds = Math.floor((anchor.targetMs - Date.now()) / 1000);
      if (totalSeconds <= 0) {
        setTimeRemaining(null);
        return;
      }
      setTimeRemaining({
        days: Math.floor(totalSeconds / (24 * 60 * 60)),
        hours: Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60)),
        minutes: Math.floor((totalSeconds % (60 * 60)) / 60),
        seconds: Math.floor(totalSeconds % 60),
      });
    };

    tick(); // immediate first render
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!timeRemaining) return null;

  if (type === 'badge') {
    return (
      <div className="text-xs text-muted-foreground mt-1.5">
        <Clock className="h-3 w-3 inline-block mr-1" />
        {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
      </div>
    );
  }

  // Detail view
  const timeString = `${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`;

  return (
    <div className="flex items-center text-sm text-muted-foreground mt-2">
      <Clock className="h-4 w-4 mr-2" />
      <span>
        {label} {timeString}
      </span>
    </div>
  );
};
