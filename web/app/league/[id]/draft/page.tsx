'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { makePick, PROGRAM_ID } from '@/lib/program';

interface Market {
    id: string;
    question: string;
    category: string;
    probability: number;
    endDate: string;
}

interface Player {
    id: number;
    address: string;
    points: number;
}

interface DraftPick {
    id: number;
    leagueId: number;
    marketId: string;
    player: string;
    prediction: string;
    session: number;
    pickIndex: number;
    snapshotOdds?: number;
}

interface League {
    id: number;
    leagueId: string;
    name: string;
    creator: string;
    buyIn: number;
    currency: string;
    maxPlayers: number;
    currentPlayers: number;
    totalSessions: number;
    marketsPerSession: number;
    status: string;
    currentSession: number;
    draftOrder: string[];
}

export default function DraftRoomPage() {
    const params = useParams();
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const wallet = useWallet();
    const { connection } = useConnection();

    const [league, setLeague] = useState<League | null>(null);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
    const [loading, setLoading] = useState(true);
    const [drafting, setDrafting] = useState(false);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('All');

    // Fetch all draft data
    const fetchDraftData = useCallback(async () => {
        if (!params.id) return;

        try {
            // Fetch league with draft order
            const leagueRes = await fetch(`/api/leagues?id=${params.id}`);
            const leagueData = await leagueRes.json();
            const leagueInfo = Array.isArray(leagueData) ? leagueData[0] : leagueData;

            if (!leagueInfo) {
                setError('League not found');
                setLoading(false);
                return;
            }

            setLeague(leagueInfo);

            // Redirect if not in drafting state
            if (leagueInfo.status === 'SETUP') {
                setError('Draft has not started yet. Wait for the league creator to start the draft.');
                setLoading(false);
                return;
            }

            // Fetch draft picks for current session
            const picksRes = await fetch(`/api/draft/picks?leagueId=${leagueInfo.id}&session=${leagueInfo.currentSession}`);
            if (picksRes.ok) {
                const picksData = await picksRes.json();
                setDraftPicks(picksData.picks || []);
            }

            // Fetch markets
            const marketsRes = await fetch('/api/markets?limit=30');
            if (marketsRes.ok) {
                const marketsData = await marketsRes.json();
                setMarkets(marketsData);
            }

            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch draft data:', err);
            setError('Failed to load draft data');
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        fetchDraftData();
        // Poll for updates every 5 seconds
        const interval = setInterval(fetchDraftData, 5000);
        return () => clearInterval(interval);
    }, [fetchDraftData]);

    // Get current drafter based on snake draft logic
    const getCurrentDrafter = useCallback(() => {
        if (!league?.draftOrder || league.draftOrder.length === 0) return null;

        const draftOrder = league.draftOrder;
        const currentPickIndex = draftPicks.length;
        const round = Math.floor(currentPickIndex / draftOrder.length);
        const positionInRound = currentPickIndex % draftOrder.length;

        // Snake draft: reverse order on odd rounds
        const playerIndex = round % 2 === 0
            ? positionInRound
            : draftOrder.length - 1 - positionInRound;

        return draftOrder[playerIndex];
    }, [league?.draftOrder, draftPicks.length]);

    const currentDrafter = getCurrentDrafter();
    const isMyTurn = connected && publicKey && currentDrafter === publicKey.toBase58();

    // Check if a market has already been drafted
    const isMarketDrafted = (marketId: string, prediction: string) => {
        return draftPicks.some(
            pick => pick.marketId === marketId && pick.prediction === prediction
        );
    };

    // Calculate expected points for display
    const calculateExpectedPoints = (probability: number, prediction: 'YES' | 'NO') => {
        const pPred = prediction === 'YES' ? probability : 1 - probability;
        const base = 100 * (1 - pPred);
        const multiplier = pPred >= 0.70 ? 1.0 : pPred >= 0.40 ? 1.2 : 1.5;
        return Math.round(base * multiplier);
    };

    // Handle draft pick
    const handleDraftPick = async (market: Market, prediction: 'YES' | 'NO') => {
        if (!connected || !publicKey || !isMyTurn || drafting) return;

        if (isMarketDrafted(market.id, prediction)) {
            alert('This market/prediction combination is already drafted');
            return;
        }

        setDrafting(true);

        try {
            // First, record in database
            const snapshotOdds = Math.round(market.probability * 10000);
            const res = await fetch('/api/draft/pick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId: league?.leagueId || params.id,
                    marketId: market.id,
                    player: publicKey.toBase58(),
                    prediction,
                    session: league?.currentSession || 1,
                    pickIndex: draftPicks.length,
                    snapshotOdds
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to record pick');
            }

            const data = await res.json();

            // Update local state immediately
            setDraftPicks(prev => [...prev, data.pick]);
            setSelectedMarket(null);

            // Optional: Trigger on-chain transaction (can be done async)
            // try {
            //     await makePick(wallet, connection, league!.id, league!.currentSession, market.id, prediction, snapshotOdds);
            // } catch (chainError) {
            //     console.warn('On-chain transaction failed, but DB pick recorded:', chainError);
            // }

        } catch (err) {
            console.error('Draft pick error:', err);
            alert(`Draft failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        setDrafting(false);
    };

    // Calculate progress
    const totalPicksNeeded = (league?.marketsPerSession || 5) * (league?.draftOrder?.length || 1);
    const isDraftComplete = draftPicks.length >= totalPicksNeeded;
    const currentRound = Math.floor(draftPicks.length / Math.max(league?.draftOrder?.length || 1, 1)) + 1;
    const maxRounds = league?.marketsPerSession || 5;

    // Get my picks
    const myPicks = publicKey
        ? draftPicks.filter(p => p.player === publicKey.toBase58())
        : [];

    // Filtered markets
    const filteredMarkets = categoryFilter === 'All'
        ? markets
        : markets.filter(m => m.category === categoryFilter);

    const categories = ['All', ...new Set(markets.map(m => m.category))];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
                <div className="text-white text-xl">Loading Draft Room...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
                <div className="text-center text-white">
                    <h1 className="text-2xl font-bold mb-4">⚠️ {error}</h1>
                    <Link href={`/league/${params.id}/lobby`} className="text-blue-400 hover:underline">
                        Back to Lobby
                    </Link>
                </div>
            </div>
        );
    }

    if (!league) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
                <div className="text-center text-white">
                    <h1 className="text-2xl font-bold mb-4">League Not Found</h1>
                    <Link href="/" className="text-blue-400 hover:underline">Go Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            {/* Top Bar */}
            <nav className="border-b border-gray-700 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href={`/league/${params.id}/lobby`} className="text-gray-400 hover:text-white">
                            ← Lobby
                        </Link>
                        <div>
                            <h1 className="font-bold">{league.name}</h1>
                            <p className="text-xs text-gray-400">Session {league.currentSession} Draft</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-semibold">Round {currentRound} / {maxRounds}</div>
                            <div className="text-xs text-gray-400">Pick {draftPicks.length + 1} of {totalPicksNeeded}</div>
                        </div>
                        {connected && (
                            <div className="bg-gray-800 px-3 py-1 rounded text-xs font-mono">
                                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Current Turn Banner */}
            {!isDraftComplete && (
                <div className={`py-3 text-center ${isMyTurn ? 'bg-green-600' : 'bg-blue-600'}`}>
                    {isMyTurn ? (
                        <span className="font-bold">🎯 It's YOUR turn! Select a market and draft.</span>
                    ) : (
                        <span>Waiting for <span className="font-mono">{currentDrafter?.slice(0, 6)}...{currentDrafter?.slice(-4)}</span> to pick</span>
                    )}
                </div>
            )}

            {isDraftComplete && (
                <div className="py-4 text-center bg-green-600">
                    <span className="font-bold text-lg">🎉 Session {league.currentSession} Draft Complete!</span>
                </div>
            )}

            <div className="container mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-4 gap-6">
                    {/* Left Column: Markets */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h2 className="font-bold text-lg mb-3">Available Markets</h2>

                            {/* Category Filters */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {categories.slice(0, 6).map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`px-3 py-1 rounded-full text-xs transition ${categoryFilter === cat
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Markets List */}
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {filteredMarkets.length === 0 ? (
                                    <p className="text-gray-400 text-center py-8">No markets available</p>
                                ) : (
                                    filteredMarkets.map(market => {
                                        const yesDisabled = isMarketDrafted(market.id, 'YES');
                                        const noDisabled = isMarketDrafted(market.id, 'NO');
                                        const isSelected = selectedMarket?.id === market.id;

                                        return (
                                            <div
                                                key={market.id}
                                                onClick={() => setSelectedMarket(market)}
                                                className={`p-4 rounded-lg border transition cursor-pointer ${isSelected
                                                        ? 'bg-blue-900/50 border-blue-500'
                                                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-medium text-sm flex-1 mr-2">
                                                        {market.question}
                                                    </h3>
                                                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded shrink-0">
                                                        {market.category}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="text-xs text-gray-400">
                                                        <span className="text-green-400">YES {(market.probability * 100).toFixed(0)}%</span>
                                                        <span className="mx-2">|</span>
                                                        <span className="text-red-400">NO {((1 - market.probability) * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            disabled={yesDisabled || !isMyTurn || isDraftComplete || drafting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDraftPick(market, 'YES');
                                                            }}
                                                            className={`px-3 py-1 rounded text-xs font-bold transition ${yesDisabled
                                                                    ? 'bg-green-900/50 text-green-400 cursor-not-allowed'
                                                                    : !isMyTurn || isDraftComplete
                                                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                        : 'bg-green-600 hover:bg-green-500'
                                                                }`}
                                                        >
                                                            {yesDisabled ? '✓ Taken' : 'YES'}
                                                        </button>
                                                        <button
                                                            disabled={noDisabled || !isMyTurn || isDraftComplete || drafting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDraftPick(market, 'NO');
                                                            }}
                                                            className={`px-3 py-1 rounded text-xs font-bold transition ${noDisabled
                                                                    ? 'bg-red-900/50 text-red-400 cursor-not-allowed'
                                                                    : !isMyTurn || isDraftComplete
                                                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                        : 'bg-red-600 hover:bg-red-500'
                                                                }`}
                                                        >
                                                            {noDisabled ? '✓ Taken' : 'NO'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Center: Selected Market Detail */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 rounded-xl p-4 sticky top-20">
                            <h2 className="font-bold text-lg mb-3 border-b border-gray-700 pb-2">
                                {selectedMarket ? 'Market Details' : 'Select a Market'}
                            </h2>
                            {selectedMarket ? (
                                <div className="space-y-4">
                                    <h3 className="font-medium">{selectedMarket.question}</h3>
                                    <div className="text-sm text-gray-400">{selectedMarket.category}</div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-green-900/30 p-3 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-green-400">
                                                {(selectedMarket.probability * 100).toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-400">YES Probability</div>
                                            <div className="text-xs text-green-400 mt-1">
                                                +{calculateExpectedPoints(selectedMarket.probability, 'YES')} pts max
                                            </div>
                                        </div>
                                        <div className="bg-red-900/30 p-3 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-red-400">
                                                {((1 - selectedMarket.probability) * 100).toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-400">NO Probability</div>
                                            <div className="text-xs text-red-400 mt-1">
                                                +{calculateExpectedPoints(selectedMarket.probability, 'NO')} pts max
                                            </div>
                                        </div>
                                    </div>

                                    {isMyTurn && !isDraftComplete && (
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                disabled={isMarketDrafted(selectedMarket.id, 'YES') || drafting}
                                                onClick={() => handleDraftPick(selectedMarket, 'YES')}
                                                className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold"
                                            >
                                                {drafting ? 'Drafting...' : 'Draft YES'}
                                            </button>
                                            <button
                                                disabled={isMarketDrafted(selectedMarket.id, 'NO') || drafting}
                                                onClick={() => handleDraftPick(selectedMarket, 'NO')}
                                                className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold"
                                            >
                                                {drafting ? 'Drafting...' : 'Draft NO'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">
                                    Click on a market to see details and draft options.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Draft Order & My Roster */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Draft Order */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h2 className="font-bold text-lg mb-3 border-b border-gray-700 pb-2">
                                Draft Order
                            </h2>
                            <div className="space-y-2">
                                {(!league.draftOrder || league.draftOrder.length === 0) ? (
                                    <p className="text-gray-400 text-sm">No players in draft</p>
                                ) : (
                                    league.draftOrder.map((address, index) => {
                                        const isCurrentDrafter = address === currentDrafter;
                                        const isMe = publicKey && address === publicKey.toBase58();
                                        const playerPicks = draftPicks.filter(p => p.player === address);

                                        return (
                                            <div
                                                key={address}
                                                className={`p-3 rounded-lg transition flex justify-between items-center ${isCurrentDrafter
                                                        ? 'bg-blue-600 ring-2 ring-blue-400'
                                                        : isMe
                                                            ? 'bg-purple-900/50 border border-purple-500'
                                                            : 'bg-gray-700'
                                                    }`}
                                            >
                                                <div>
                                                    <span className="font-mono text-sm">
                                                        {address.slice(0, 6)}...{address.slice(-4)}
                                                    </span>
                                                    {isMe && <span className="ml-2 text-xs text-purple-300">(You)</span>}
                                                    {isCurrentDrafter && !isDraftComplete && (
                                                        <div className="text-xs text-blue-200 mt-1">⏰ On the clock</div>
                                                    )}
                                                </div>
                                                <span className="text-sm text-gray-300">
                                                    {playerPicks.length}/{league.marketsPerSession || 5}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* My Roster */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h2 className="font-bold text-lg mb-3 border-b border-gray-700 pb-2">
                                My Picks ({myPicks.length}/{league.marketsPerSession || 5})
                            </h2>
                            <div className="space-y-2">
                                {myPicks.length === 0 ? (
                                    <p className="text-gray-400 text-sm text-center py-4">
                                        No picks yet
                                    </p>
                                ) : (
                                    myPicks.map((pick) => (
                                        <div key={pick.id} className="p-2 bg-gray-700/50 rounded text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-300 truncate flex-1 mr-2">
                                                    {pick.marketId.slice(0, 20)}...
                                                </span>
                                                <span className={`px-2 py-0.5 rounded font-bold text-xs ${pick.prediction === 'YES' ? 'bg-green-600' : 'bg-red-600'
                                                    }`}>
                                                    {pick.prediction}
                                                </span>
                                            </div>
                                            {pick.snapshotOdds && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    Drafted at {(pick.snapshotOdds / 100).toFixed(0)}%
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                                {/* Placeholder slots */}
                                {Array.from({ length: Math.max(0, (league.marketsPerSession || 5) - myPicks.length) }).map((_, i) => (
                                    <div key={`placeholder-${i}`} className="p-3 border-2 border-dashed border-gray-600 rounded text-center text-gray-500 text-sm">
                                        Pick {myPicks.length + i + 1}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h2 className="font-bold text-lg mb-3 border-b border-gray-700 pb-2">
                                Recent Picks
                            </h2>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {draftPicks.length === 0 ? (
                                    <p className="text-gray-400 text-sm text-center py-4">No picks yet</p>
                                ) : (
                                    [...draftPicks].reverse().slice(0, 10).map((pick) => (
                                        <div key={pick.id} className="p-2 bg-gray-700/30 rounded text-xs">
                                            <span className="font-mono">{pick.player.slice(0, 6)}...</span>
                                            <span className="mx-1">drafted</span>
                                            <span className={pick.prediction === 'YES' ? 'text-green-400' : 'text-red-400'}>
                                                {pick.prediction}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
