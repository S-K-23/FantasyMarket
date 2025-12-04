'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
    buyIn: string;
    currency: string;
    maxPlayers: number;
    totalSessions: number;
    marketsPerSession: number;
    status: string;
    currentSession: number;
    players?: Player[];
}

export default function MockDraftPage() {
    const params = useParams();
    const router = useRouter();
    const [league, setLeague] = useState<League | null>(null);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
    const [draftOrder, setDraftOrder] = useState<string[]>([]);
    const [currentPickIndex, setCurrentPickIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [drafting, setDrafting] = useState(false);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

    // Fetch league data
    useEffect(() => {
        if (!params.id) return;

        const fetchData = async () => {
            try {
                // Fetch league
                const leagueRes = await fetch(`/api/leagues?id=${params.id}`);
                const leagueData = await leagueRes.json();
                const leagueInfo = Array.isArray(leagueData) ? leagueData[0] : leagueData;
                setLeague(leagueInfo);

                // Fetch players for this league
                const playersRes = await fetch(`/api/leagues/${params.id}/players`);
                if (playersRes.ok) {
                    const playersData = await playersRes.json();
                    setPlayers(playersData.players || []);

                    // Create draft order (snake draft simulation)
                    const order = playersData.players?.map((p: Player) => p.address) || [];
                    setDraftOrder(order);
                }

                // Fetch existing draft picks
                const picksRes = await fetch(`/api/draft/picks?leagueId=${params.id}`);
                if (picksRes.ok) {
                    const picksData = await picksRes.json();
                    setDraftPicks(picksData.picks || []);
                    setCurrentPickIndex(picksData.picks?.length || 0);
                }

                // Fetch markets
                const marketsRes = await fetch('/api/markets?limit=20');
                if (marketsRes.ok) {
                    const marketsData = await marketsRes.json();
                    setMarkets(marketsData);
                }

                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [params.id]);

    // Get current drafter based on snake draft logic
    const getCurrentDrafter = useCallback(() => {
        if (draftOrder.length === 0) return null;
        const round = Math.floor(currentPickIndex / draftOrder.length);
        const positionInRound = currentPickIndex % draftOrder.length;

        // Snake draft: reverse order on odd rounds
        const playerIndex = round % 2 === 0
            ? positionInRound
            : draftOrder.length - 1 - positionInRound;

        return draftOrder[playerIndex];
    }, [currentPickIndex, draftOrder]);

    // Check if a market has already been drafted
    const isMarketDrafted = (marketId: string, prediction: string) => {
        return draftPicks.some(
            pick => pick.marketId === marketId && pick.prediction === prediction
        );
    };

    // Handle draft pick
    const handleDraftPick = async (market: Market, prediction: 'YES' | 'NO') => {
        if (drafting) return;

        const currentDrafter = getCurrentDrafter();
        if (!currentDrafter) {
            alert('No players in draft order');
            return;
        }

        if (isMarketDrafted(market.id, prediction)) {
            alert('This market/prediction combination is already drafted');
            return;
        }

        setDrafting(true);

        try {
            const res = await fetch('/api/draft/pick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId: league?.leagueId || params.id,
                    marketId: market.id,
                    player: currentDrafter,
                    prediction,
                    session: league?.currentSession || 1,
                    pickIndex: currentPickIndex,
                    snapshotOdds: Math.round(market.probability * 10000)
                })
            });

            if (res.ok) {
                const data = await res.json();
                setDraftPicks(prev => [...prev, data.pick]);
                setCurrentPickIndex(prev => prev + 1);
                setSelectedMarket(null);
            } else {
                const error = await res.json();
                alert(`Draft failed: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Draft pick error:', error);
            alert('Failed to submit draft pick');
        }

        setDrafting(false);
    };

    // Calculate total picks needed for this session
    const totalPicksNeeded = (league?.marketsPerSession || 5) * draftOrder.length;
    const isDraftComplete = currentPickIndex >= totalPicksNeeded;
    const currentRound = Math.floor(currentPickIndex / Math.max(draftOrder.length, 1)) + 1;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
                <div className="text-white text-xl">Loading Mock Draft...</div>
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
            {/* Header */}
            <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <Link href={`/league/${params.id}/lobby`} className="text-xl font-bold hover:text-blue-400">
                        ← Back to Lobby
                    </Link>
                    <div className="text-sm text-gray-400">
                        Mock Draft Mode (DB Only)
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-8">
                {/* Draft Status Banner */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 mb-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold">{league.name}</h1>
                            <p className="text-blue-100">Session {league.currentSession || 1} Draft</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">
                                Round {currentRound} / {league.marketsPerSession || 5}
                            </div>
                            <div className="text-blue-100">
                                Pick {currentPickIndex + 1} of {totalPicksNeeded}
                            </div>
                        </div>
                    </div>
                </div>

                {isDraftComplete && (
                    <div className="bg-green-600 rounded-xl p-6 mb-8 text-center">
                        <h2 className="text-2xl font-bold">🎉 Draft Complete!</h2>
                        <p>All picks have been made for this session.</p>
                    </div>
                )}

                <div className="grid lg:grid-cols-4 gap-6">
                    {/* Draft Order Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 rounded-xl p-4 sticky top-4">
                            <h2 className="font-bold text-lg mb-4 border-b border-gray-700 pb-2">
                                Draft Order
                            </h2>
                            <div className="space-y-2">
                                {draftOrder.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No players yet</p>
                                ) : (
                                    draftOrder.map((address, index) => {
                                        const isCurrentDrafter = address === getCurrentDrafter();
                                        const playerPicks = draftPicks.filter(p => p.player === address);
                                        return (
                                            <div
                                                key={address}
                                                className={`p-3 rounded-lg transition ${isCurrentDrafter
                                                        ? 'bg-blue-600 ring-2 ring-blue-400'
                                                        : 'bg-gray-700'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-mono text-sm">
                                                        {address.slice(0, 6)}...{address.slice(-4)}
                                                    </span>
                                                    <span className="text-xs text-gray-300">
                                                        {playerPicks.length}/{league.marketsPerSession || 5}
                                                    </span>
                                                </div>
                                                {isCurrentDrafter && !isDraftComplete && (
                                                    <div className="text-xs text-blue-200 mt-1">
                                                        ⏰ On the clock
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Add Mock Player Button */}
                            <button
                                onClick={async () => {
                                    const mockAddress = `MockPlayer${Date.now()}`;
                                    try {
                                        await fetch('/api/league/join', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                leagueId: league.leagueId || params.id,
                                                player: mockAddress,
                                                signature: 'mock'
                                            })
                                        });
                                        setDraftOrder(prev => [...prev, mockAddress]);
                                        setPlayers(prev => [...prev, { id: Date.now(), address: mockAddress }]);
                                    } catch (error) {
                                        console.error('Failed to add mock player:', error);
                                    }
                                }}
                                className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                            >
                                + Add Mock Player
                            </button>
                        </div>
                    </div>

                    {/* Markets Panel */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h2 className="font-bold text-lg mb-4 border-b border-gray-700 pb-2">
                                Available Markets
                            </h2>
                            {markets.length === 0 ? (
                                <p className="text-gray-400 text-center py-8">
                                    No markets available. Check API connection.
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {markets.map(market => {
                                        const yesDisabled = isMarketDrafted(market.id, 'YES');
                                        const noDisabled = isMarketDrafted(market.id, 'NO');
                                        const isSelected = selectedMarket?.id === market.id;

                                        return (
                                            <div
                                                key={market.id}
                                                className={`p-4 rounded-lg border transition cursor-pointer ${isSelected
                                                        ? 'bg-blue-900/50 border-blue-500'
                                                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                                                    }`}
                                                onClick={() => setSelectedMarket(market)}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-medium text-sm flex-1 mr-2">
                                                        {market.question}
                                                    </h3>
                                                    <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                                                        {market.category}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="text-xs text-gray-400">
                                                        YES: {(market.probability * 100).toFixed(0)}% |
                                                        NO: {((1 - market.probability) * 100).toFixed(0)}%
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            disabled={yesDisabled || isDraftComplete || drafting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDraftPick(market, 'YES');
                                                            }}
                                                            className={`px-3 py-1 rounded text-xs font-bold ${yesDisabled || isDraftComplete
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-green-600 hover:bg-green-500'
                                                                }`}
                                                        >
                                                            {yesDisabled ? '✓ YES' : 'Draft YES'}
                                                        </button>
                                                        <button
                                                            disabled={noDisabled || isDraftComplete || drafting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDraftPick(market, 'NO');
                                                            }}
                                                            className={`px-3 py-1 rounded text-xs font-bold ${noDisabled || isDraftComplete
                                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-red-600 hover:bg-red-500'
                                                                }`}
                                                        >
                                                            {noDisabled ? '✓ NO' : 'Draft NO'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Picks History Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 rounded-xl p-4 sticky top-4">
                            <h2 className="font-bold text-lg mb-4 border-b border-gray-700 pb-2">
                                Draft Picks ({draftPicks.length})
                            </h2>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {draftPicks.length === 0 ? (
                                    <p className="text-gray-400 text-sm text-center py-4">
                                        No picks yet
                                    </p>
                                ) : (
                                    [...draftPicks].reverse().map((pick, index) => (
                                        <div
                                            key={pick.id}
                                            className="p-2 bg-gray-700/50 rounded text-xs"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-mono text-gray-300">
                                                    {pick.player.slice(0, 6)}...
                                                </span>
                                                <span className={`px-2 py-0.5 rounded font-bold ${pick.prediction === 'YES'
                                                        ? 'bg-green-600'
                                                        : 'bg-red-600'
                                                    }`}>
                                                    {pick.prediction}
                                                </span>
                                            </div>
                                            <div className="text-gray-400 truncate">
                                                {pick.marketId.slice(0, 20)}...
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Clear Draft Button */}
                            {draftPicks.length > 0 && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('Clear all picks? This cannot be undone.')) return;
                                        // In a real app, you'd call an API to clear picks
                                        setDraftPicks([]);
                                        setCurrentPickIndex(0);
                                    }}
                                    className="w-full mt-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm"
                                >
                                    Clear Draft (Local)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
