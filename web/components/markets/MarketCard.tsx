'use client';

import React, { useState } from 'react';
import { Market } from './types';
import { cn } from '@/lib/utils';
import { ExternalLink, DollarSign, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { estimatePointsIfCorrect, estimatePenaltyIfWrong, getTierName } from '@/lib/scoring';

interface MarketCardProps {
    market: Market;
    onDraft?: (market: Market, prediction: 'YES' | 'NO') => void;
    disabled?: boolean;
    yesTaken?: boolean;
    noTaken?: boolean;
}

export function MarketCard({ market, onDraft, disabled, yesTaken, noTaken }: MarketCardProps) {
    const [hoveredPrediction, setHoveredPrediction] = useState<'YES' | 'NO' | null>(null);

    const yesProb = Math.round(market.current_price_yes * 100);
    const noProb = Math.round(market.current_price_no * 100);

    const isExpired = new Date(market.end_date) < new Date();
    const isBothTaken = yesTaken && noTaken;

    // Calculate estimated points
    const yesEstimate = estimatePointsIfCorrect('YES', market.current_price_yes);
    const noEstimate = estimatePointsIfCorrect('NO', market.current_price_yes);
    const yesPenalty = estimatePenaltyIfWrong('YES', market.current_price_yes);
    const noPenalty = estimatePenaltyIfWrong('NO', market.current_price_yes);

    return (
        <div className={cn(
            "group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-300",
            isBothTaken
                ? "border-zinc-800/50 bg-zinc-900/30 opacity-60"
                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
        )}>
            {/* Header */}
            <div className="p-4 flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                        {market.category}
                    </span>
                    <a
                        href={market.polymarket_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </div>

                <h3 className="font-semibold text-zinc-100 leading-tight mb-2 line-clamp-2 min-h-[2.5rem]" title={market.title}>
                    {market.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-zinc-400 mt-4">
                    <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span>${(market.liquidity || 0).toLocaleString()} Liq</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(market.end_date).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            {/* Probabilities & Actions */}
            <div className="p-4 pt-0 mt-auto">
                <div className="grid grid-cols-2 gap-3">
                    {/* YES Button */}
                    <button
                        onClick={() => onDraft?.(market, 'YES')}
                        onMouseEnter={() => setHoveredPrediction('YES')}
                        onMouseLeave={() => setHoveredPrediction(null)}
                        disabled={disabled || isExpired || yesTaken}
                        className={cn(
                            "relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                            yesTaken
                                ? "bg-zinc-800/50 border-zinc-700/50 cursor-not-allowed"
                                : "bg-emerald-950/30 border-emerald-900/50 hover:bg-emerald-900/40 hover:border-emerald-700",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {yesTaken ? (
                            <>
                                <span className="text-xs font-medium text-zinc-500 mb-1">YES</span>
                                <span className="text-sm font-bold text-zinc-500">TAKEN</span>
                            </>
                        ) : (
                            <>
                                <span className="text-xs font-medium text-emerald-400 mb-1">YES</span>
                                <span className="text-xl font-bold text-emerald-300">{yesProb}%</span>
                                {hoveredPrediction === 'YES' && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                                        <span className="text-emerald-400">+{yesEstimate.points}</span>
                                        <span className="text-zinc-500"> / </span>
                                        <span className="text-red-400">{yesPenalty}</span>
                                        <span className="text-zinc-500 ml-1">({yesEstimate.tier})</span>
                                    </div>
                                )}
                            </>
                        )}
                    </button>

                    {/* NO Button */}
                    <button
                        onClick={() => onDraft?.(market, 'NO')}
                        onMouseEnter={() => setHoveredPrediction('NO')}
                        onMouseLeave={() => setHoveredPrediction(null)}
                        disabled={disabled || isExpired || noTaken}
                        className={cn(
                            "relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                            noTaken
                                ? "bg-zinc-800/50 border-zinc-700/50 cursor-not-allowed"
                                : "bg-red-950/30 border-red-900/50 hover:bg-red-900/40 hover:border-red-700",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {noTaken ? (
                            <>
                                <span className="text-xs font-medium text-zinc-500 mb-1">NO</span>
                                <span className="text-sm font-bold text-zinc-500">TAKEN</span>
                            </>
                        ) : (
                            <>
                                <span className="text-xs font-medium text-red-400 mb-1">NO</span>
                                <span className="text-xl font-bold text-red-300">{noProb}%</span>
                                {hoveredPrediction === 'NO' && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                                        <span className="text-emerald-400">+{noEstimate.points}</span>
                                        <span className="text-zinc-500"> / </span>
                                        <span className="text-red-400">{noPenalty}</span>
                                        <span className="text-zinc-500 ml-1">({noEstimate.tier})</span>
                                    </div>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
