'use client';

import { useState } from 'react';
import { MarketBrowser } from '@/components/markets/MarketBrowser';
import { Market } from '@/components/markets/types';
import { estimatePointsIfCorrect } from '@/lib/scoring';

interface DraftPick {
    market_id: string;
    prediction: 'YES' | 'NO';
    player: string;
    snapshot_odds: number;
    title: string;
    estimated_points: number;
}

export default function TestMarketsPage() {
    const [picks, setPicks] = useState<DraftPick[]>([]);

    const handleDraft = (market: Market, prediction: 'YES' | 'NO') => {
        const { points } = estimatePointsIfCorrect(prediction, market.current_price_yes);

        const newPick: DraftPick = {
            market_id: market.market_id,
            prediction,
            player: 'demo-player',
            snapshot_odds: prediction === 'YES' ? market.current_price_yes : market.current_price_no,
            title: market.title,
            estimated_points: points,
        };

        setPicks(prev => [...prev, newPick]);
    };

    const totalEstimatedPoints = picks.reduce((sum, pick) => sum + pick.estimated_points, 0);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Fantasy Forecast League
                        </h1>
                        <p className="text-sm text-zinc-500">Draft Room - Demo Mode</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-zinc-400">Picks: {picks.length}/5</div>
                        <div className="text-lg font-bold text-emerald-400">
                            Est. Points: +{totalEstimatedPoints}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 flex gap-6">
                {/* Main Content */}
                <div className="flex-1">
                    <MarketBrowser
                        onDraftPick={handleDraft}
                        existingPicks={picks}
                        isMyTurn={true}
                    />
                </div>

                {/* Sidebar - Draft Picks */}
                <div className="w-80 shrink-0 hidden lg:block">
                    <div className="sticky top-24 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                        <h2 className="text-lg font-semibold mb-4">Your Picks</h2>

                        {picks.length === 0 ? (
                            <p className="text-zinc-500 text-sm">
                                Click on a market and select YES or NO to make your picks.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {picks.map((pick, index) => (
                                    <div
                                        key={`${pick.market_id}-${pick.prediction}`}
                                        className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-zinc-500">Pick #{index + 1}</span>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${pick.prediction === 'YES'
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {pick.prediction}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-300 line-clamp-2 mb-2">
                                            {pick.title}
                                        </p>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-zinc-500">
                                                @ {Math.round(pick.snapshot_odds * 100)}%
                                            </span>
                                            <span className="text-emerald-400 font-medium">
                                                +{pick.estimated_points} pts if correct
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {picks.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-700">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-400">Total if all correct:</span>
                                    <span className="text-emerald-400 font-bold">+{totalEstimatedPoints} pts</span>
                                </div>
                                <button
                                    onClick={() => setPicks([])}
                                    className="w-full mt-4 py-2 bg-red-950/30 border border-red-900/50 text-red-400 rounded-lg text-sm hover:bg-red-900/40 transition-colors"
                                >
                                    Clear All Picks
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
