'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Market } from './types';
import { MarketCard } from './MarketCard';
import { MarketDetailModal } from './MarketDetailModal';
import { Search, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftPick {
    market_id: string;
    prediction: 'YES' | 'NO';
    player: string;
    snapshot_odds: number;
}

interface MarketBrowserProps {
    leagueId?: number;
    sessionIndex?: number;
    onDraftPick?: (market: Market, prediction: 'YES' | 'NO') => void;
    currentPlayerAddress?: string;
    existingPicks?: DraftPick[];
    isMyTurn?: boolean;
}

const CATEGORIES = ['All', 'Sports', 'Politics', 'Crypto', 'Pop Culture', 'Business', 'Science'];

export function MarketBrowser({
    leagueId,
    sessionIndex,
    onDraftPick,
    currentPlayerAddress,
    existingPicks = [],
    isMyTurn = true
}: MarketBrowserProps) {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchMarkets = useCallback(async (reset = false) => {
        try {
            if (reset) {
                setLoading(true);
            }
            const currentOffset = reset ? 0 : offset;

            const params = new URLSearchParams({
                limit: '24',
                offset: currentOffset.toString(),
                min_liquidity: '1000',
            });

            if (category && category !== 'All') params.append('category', category.toLowerCase());

            const res = await fetch(`/api/polymarket/markets?${params.toString()}`);
            const data = await res.json();

            if (data.error) {
                console.error('API returned error:', data.error);
                return;
            }

            if (reset) {
                setMarkets(data.markets || []);
                setOffset(24);
            } else {
                setMarkets(prev => [...prev, ...(data.markets || [])]);
                setOffset(prev => prev + 24);
            }

            setHasMore(data.hasMore || false);

        } catch (error) {
            console.error("Failed to fetch markets", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [category, offset]);

    // Initial fetch and category change
    useEffect(() => {
        setOffset(0);
        fetchMarkets(true);
    }, [category]);

    const handleRefresh = () => {
        setRefreshing(true);
        setOffset(0);
        fetchMarkets(true);
    };

    const handleLoadMore = () => {
        fetchMarkets(false);
    };

    // Check if a prediction is taken for a market
    const isPredictionTaken = (marketId: string, prediction: 'YES' | 'NO'): boolean => {
        return existingPicks.some(
            pick => pick.market_id === marketId && pick.prediction === prediction
        );
    };

    // Handle draft action
    const handleDraft = (market: Market, prediction: 'YES' | 'NO') => {
        if (!isMyTurn) {
            alert("It's not your turn to draft!");
            return;
        }

        if (isPredictionTaken(market.market_id, prediction)) {
            alert(`${prediction} has already been drafted for this market!`);
            return;
        }

        onDraftPick?.(market, prediction);
        setSelectedMarket(null);
    };

    // Client-side search filtering
    const displayedMarkets = markets.filter(m =>
        m.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(debouncedSearch.toLowerCase()))
    );

    return (
        <div className="w-full space-y-6">
            {/* Header with Turn Indicator */}
            {!isMyTurn && (
                <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3 text-center text-amber-400 text-sm">
                    Waiting for other player to draft...
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search markets..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={cn("h-4 w-4 text-zinc-400", refreshing && "animate-spin")} />
                    </button>

                    <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                                    category === cat
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedMarkets.map(market => (
                    <div
                        key={market.market_id}
                        onClick={() => setSelectedMarket(market)}
                        className="cursor-pointer"
                    >
                        <MarketCard
                            market={market}
                            onDraft={handleDraft}
                            disabled={!isMyTurn}
                            yesTaken={isPredictionTaken(market.market_id, 'YES')}
                            noTaken={isPredictionTaken(market.market_id, 'NO')}
                        />
                    </div>
                ))}

                {loading && (
                    <div className="col-span-full flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                    </div>
                )}

                {!loading && displayedMarkets.length === 0 && (
                    <div className="col-span-full text-center py-12 text-zinc-500">
                        No markets found. Try adjusting your filters.
                    </div>
                )}
            </div>

            {/* Load More */}
            {hasMore && !loading && displayedMarkets.length > 0 && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={handleLoadMore}
                        className="px-6 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
                    >
                        Load More Markets
                    </button>
                </div>
            )}

            {/* Detail Modal */}
            <MarketDetailModal
                market={selectedMarket}
                onClose={() => setSelectedMarket(null)}
                onDraft={handleDraft}
                yesTaken={selectedMarket ? isPredictionTaken(selectedMarket.market_id, 'YES') : false}
                noTaken={selectedMarket ? isPredictionTaken(selectedMarket.market_id, 'NO') : false}
                disabled={!isMyTurn}
            />
        </div>
    );
}
