'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { calculateLiveScore } from '@/lib/scoring';

interface DraftedPick {
    market_id: string;
    title: string;
    prediction: 'YES' | 'NO';
    snapshot_odds: number; // YES probability at draft time (0-1)
    current_odds?: number; // Current YES probability (0-1)
    is_resolved?: boolean;
    resolution?: 'YES' | 'NO' | null;
}

interface LiveOddsTrackerProps {
    picks: DraftedPick[];
    pollInterval?: number; // milliseconds
    onOddsUpdate?: (picks: DraftedPick[]) => void;
}

export function LiveOddsTracker({
    picks,
    pollInterval = 30000,
    onOddsUpdate
}: LiveOddsTrackerProps) {
    const [trackedPicks, setTrackedPicks] = useState<DraftedPick[]>(picks);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isPolling, setIsPolling] = useState(false);

    // Update when picks prop changes
    useEffect(() => {
        setTrackedPicks(picks);
    }, [picks]);

    // Poll for price updates
    useEffect(() => {
        const fetchCurrentOdds = async () => {
            if (trackedPicks.length === 0) return;

            setIsPolling(true);
            try {
                // Fetch current prices for all markets
                const marketIds = [...new Set(trackedPicks.map(p => p.market_id))];

                const updatedPicks = await Promise.all(
                    trackedPicks.map(async (pick) => {
                        try {
                            const res = await fetch(`/api/polymarket/market/${pick.market_id}`);
                            if (!res.ok) return pick;

                            const data = await res.json();
                            return {
                                ...pick,
                                current_odds: data.current_price_yes || pick.current_odds,
                            };
                        } catch {
                            return pick;
                        }
                    })
                );

                setTrackedPicks(updatedPicks);
                onOddsUpdate?.(updatedPicks);
                setLastUpdate(new Date());
            } catch (error) {
                console.error('Failed to fetch odds:', error);
            } finally {
                setIsPolling(false);
            }
        };

        // Initial fetch
        fetchCurrentOdds();

        // Set up polling interval
        const interval = setInterval(fetchCurrentOdds, pollInterval);
        return () => clearInterval(interval);
    }, [trackedPicks.length, pollInterval]);

    if (trackedPicks.length === 0) {
        return (
            <div className="text-center text-zinc-500 py-8">
                No picks to track yet.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Live Odds Tracker</span>
                <span className="text-zinc-600 text-xs flex items-center gap-1">
                    {isPolling && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                    Updated {lastUpdate.toLocaleTimeString()}
                </span>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-2 bg-amber-950/20 border border-amber-900/30 rounded-lg text-xs text-amber-500">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Live scores are for display only. Final points are calculated at market resolution.</span>
            </div>

            {/* Picks List */}
            <div className="space-y-3">
                {trackedPicks.map((pick) => {
                    const currentOdds = pick.current_odds ?? pick.snapshot_odds;
                    const liveScore = calculateLiveScore(pick.prediction, pick.snapshot_odds, currentOdds);
                    const oddsChange = pick.prediction === 'YES'
                        ? currentOdds - pick.snapshot_odds
                        : pick.snapshot_odds - currentOdds;

                    const isWinning = liveScore > 0;
                    const isLosing = liveScore < 0;
                    const isNeutral = liveScore === 0;

                    return (
                        <div
                            key={`${pick.market_id}-${pick.prediction}`}
                            className={cn(
                                "p-4 rounded-lg border transition-colors",
                                isWinning && "bg-emerald-950/20 border-emerald-900/50",
                                isLosing && "bg-red-950/20 border-red-900/50",
                                isNeutral && "bg-zinc-900/50 border-zinc-800"
                            )}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-zinc-300 font-medium truncate" title={pick.title}>
                                        {pick.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn(
                                            "text-xs font-semibold px-2 py-0.5 rounded",
                                            pick.prediction === 'YES'
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-red-500/20 text-red-400"
                                        )}>
                                            {pick.prediction}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            @ {Math.round(pick.snapshot_odds * 100)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    {/* Live Score */}
                                    <div className={cn(
                                        "text-lg font-bold flex items-center gap-1",
                                        isWinning && "text-emerald-400",
                                        isLosing && "text-red-400",
                                        isNeutral && "text-zinc-400"
                                    )}>
                                        {isWinning && <TrendingUp className="h-4 w-4" />}
                                        {isLosing && <TrendingDown className="h-4 w-4" />}
                                        {isNeutral && <Minus className="h-4 w-4" />}
                                        {liveScore > 0 ? '+' : ''}{liveScore.toFixed(1)}
                                    </div>

                                    {/* Current Odds */}
                                    <div className="text-xs text-zinc-500 mt-0.5">
                                        Now: {Math.round(currentOdds * 100)}%
                                        {oddsChange !== 0 && (
                                            <span className={cn(
                                                "ml-1",
                                                oddsChange > 0 ? "text-emerald-400" : "text-red-400"
                                            )}>
                                                ({oddsChange > 0 ? '+' : ''}{Math.round(oddsChange * 100)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Total Live Score */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Total Live Score</span>
                    <span className={cn(
                        "text-xl font-bold",
                        trackedPicks.reduce((sum, pick) => {
                            const currentOdds = pick.current_odds ?? pick.snapshot_odds;
                            return sum + calculateLiveScore(pick.prediction, pick.snapshot_odds, currentOdds);
                        }, 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                        {(() => {
                            const total = trackedPicks.reduce((sum, pick) => {
                                const currentOdds = pick.current_odds ?? pick.snapshot_odds;
                                return sum + calculateLiveScore(pick.prediction, pick.snapshot_odds, currentOdds);
                            }, 0);
                            return `${total >= 0 ? '+' : ''}${total.toFixed(1)}`;
                        })()}
                    </span>
                </div>
            </div>
        </div>
    );
}
