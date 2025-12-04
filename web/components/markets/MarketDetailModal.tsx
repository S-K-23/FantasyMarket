'use client';

import React from 'react';
import { Market } from './types';
import { cn } from '@/lib/utils';
import { X, ExternalLink, Clock, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { estimatePointsIfCorrect, estimatePenaltyIfWrong, getTierName } from '@/lib/scoring';

interface MarketDetailModalProps {
    market: Market | null;
    onClose: () => void;
    onDraft?: (market: Market, prediction: 'YES' | 'NO') => void;
    yesTaken?: boolean;
    noTaken?: boolean;
    disabled?: boolean;
}

export function MarketDetailModal({
    market,
    onClose,
    onDraft,
    yesTaken,
    noTaken,
    disabled
}: MarketDetailModalProps) {
    if (!market) return null;

    const yesProb = Math.round(market.current_price_yes * 100);
    const noProb = Math.round(market.current_price_no * 100);
    const isExpired = new Date(market.end_date) < new Date();

    // Scoring estimates
    const yesEstimate = estimatePointsIfCorrect('YES', market.current_price_yes);
    const noEstimate = estimatePointsIfCorrect('NO', market.current_price_yes);
    const yesPenalty = estimatePenaltyIfWrong('YES', market.current_price_yes);
    const noPenalty = estimatePenaltyIfWrong('NO', market.current_price_yes);

    // Time until resolution
    const endDate = new Date(market.end_date);
    const now = new Date();
    const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-zinc-800">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                                {market.category}
                            </span>
                            <span className="text-xs text-zinc-500">
                                {daysUntil > 0 ? `${daysUntil} days left` : 'Ended'}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-zinc-100">
                            {market.title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Description */}
                    {market.description && (
                        <div>
                            <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                {market.description}
                            </p>
                        </div>
                    )}

                    {/* Current Odds */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">Current Odds</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 text-center">
                                <div className="text-emerald-400 text-sm font-medium mb-1">YES</div>
                                <div className="text-4xl font-bold text-emerald-300">{yesProb}%</div>
                            </div>
                            <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 text-center">
                                <div className="text-red-400 text-sm font-medium mb-1">NO</div>
                                <div className="text-4xl font-bold text-red-300">{noProb}%</div>
                            </div>
                        </div>
                    </div>

                    {/* Scoring Preview */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">Scoring Preview</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {/* YES Scoring */}
                            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                                <div className="text-sm font-medium text-emerald-400 mb-2">If you draft YES:</div>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">If correct:</span>
                                        <span className="text-emerald-400 font-medium">+{yesEstimate.points} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">If wrong:</span>
                                        <span className="text-red-400 font-medium">{yesPenalty} pts</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-zinc-700">
                                        <span className="text-zinc-400">Tier:</span>
                                        <span className={cn(
                                            "font-medium",
                                            yesEstimate.tier === 'Long-shot' && "text-purple-400",
                                            yesEstimate.tier === 'Balanced' && "text-yellow-400",
                                            yesEstimate.tier === 'Favorite' && "text-blue-400"
                                        )}>
                                            {yesEstimate.tier} ({yesEstimate.multiplier}x)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* NO Scoring */}
                            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                                <div className="text-sm font-medium text-red-400 mb-2">If you draft NO:</div>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">If correct:</span>
                                        <span className="text-emerald-400 font-medium">+{noEstimate.points} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">If wrong:</span>
                                        <span className="text-red-400 font-medium">{noPenalty} pts</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-zinc-700">
                                        <span className="text-zinc-400">Tier:</span>
                                        <span className={cn(
                                            "font-medium",
                                            noEstimate.tier === 'Long-shot' && "text-purple-400",
                                            noEstimate.tier === 'Balanced' && "text-yellow-400",
                                            noEstimate.tier === 'Favorite' && "text-blue-400"
                                        )}>
                                            {noEstimate.tier} ({noEstimate.multiplier}x)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm text-zinc-400">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span>${(market.liquidity || 0).toLocaleString()} liquidity</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            <span>${(market.volume || 0).toLocaleString()} volume</span>
                        </div>
                        <a
                            href={market.polymarket_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors ml-auto"
                        >
                            <span>View on Polymarket</span>
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0">
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => onDraft?.(market, 'YES')}
                            disabled={disabled || isExpired || yesTaken}
                            className={cn(
                                "py-3 px-4 rounded-xl font-semibold transition-all",
                                yesTaken
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {yesTaken ? 'YES Taken' : `Draft YES (+${yesEstimate.points} if correct)`}
                        </button>
                        <button
                            onClick={() => onDraft?.(market, 'NO')}
                            disabled={disabled || isExpired || noTaken}
                            className={cn(
                                "py-3 px-4 rounded-xl font-semibold transition-all",
                                noTaken
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                    : "bg-red-600 hover:bg-red-500 text-white",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {noTaken ? 'NO Taken' : `Draft NO (+${noEstimate.points} if correct)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
