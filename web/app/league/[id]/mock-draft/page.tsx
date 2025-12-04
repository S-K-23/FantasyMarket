'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Market {
    market_id: string;
    title: string;
    description: string;
    category: string;
    end_date: string;
    current_price_yes: number;
    current_price_no: number;
    liquidity: number;
    volume: number;
    polymarket_url: string;
    outcomes: string[];
    active: boolean;
    token_id_yes?: string;
    token_id_no?: string;
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
    marketTitle?: string;
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
    const [marketTitles, setMarketTitles] = useState<Record<string, string>>({});

    // NEW: Selected player for manual draft control
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
    const [draftMode, setDraftMode] = useState<'auto' | 'manual'>('auto');

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

                // Fetch REAL Polymarket markets from dedicated API
                // Filter by league category if specified
                const categoryParam = leagueInfo.category ? `&category=${encodeURIComponent(leagueInfo.category)}` : '';
                const marketsRes = await fetch(`/api/polymarket/markets?limit=30&min_liquidity=100${categoryParam}`);
                if (marketsRes.ok) {
                    const marketsData = await marketsRes.json();
                    const marketsList = marketsData.markets || [];
                    setMarkets(marketsList);

                    // Build title lookup
                    const titles: Record<string, string> = {};
                    marketsList.forEach((m: Market) => {
                        titles[m.market_id] = m.title;
                    });
                    setMarketTitles(titles);
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

    // Get the active drafter (manual selection or auto)
    const getActiveDrafter = useCallback(() => {
        if (draftMode === 'manual' && selectedPlayer) {
            return selectedPlayer;
        }
        return getCurrentDrafter();
    }, [draftMode, selectedPlayer, getCurrentDrafter]);

    // Check if a market has already been drafted
    const isMarketDrafted = (marketId: string, prediction: string) => {
        return draftPicks.some(
            pick => pick.marketId === marketId && pick.prediction === prediction
        );
    };

    // Get picks count for a specific player
    const getPlayerPickCount = (address: string) => {
        return draftPicks.filter(p => p.player === address).length;
    };

    // Handle draft pick
    const handleDraftPick = async (market: Market, prediction: 'YES' | 'NO') => {
        if (drafting) return;

        const activeDrafter = getActiveDrafter();
        if (!activeDrafter) {
            alert('Please select a player to draft for');
            return;
        }

        if (isMarketDrafted(market.market_id, prediction)) {
            alert('This market/prediction combination is already drafted');
            return;
        }

        // Check if player already has max picks
        const playerPickCount = getPlayerPickCount(activeDrafter);
        const maxPicks = league?.marketsPerSession || 5;
        if (playerPickCount >= maxPicks) {
            alert(`${activeDrafter.slice(0, 8)}... already has ${maxPicks} picks!`);
            return;
        }

        setDrafting(true);

        // Get the odds for the selected prediction (in basis points)
        const oddsDecimal = prediction === 'YES' ? market.current_price_yes : market.current_price_no;
        const snapshotOdds = Math.round(oddsDecimal * 10000); // Convert to basis points (e.g., 0.65 -> 6500)

        try {
            const res = await fetch('/api/draft/pick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId: league?.leagueId || params.id,
                    marketId: market.market_id,
                    marketTitle: market.title,
                    marketCategory: market.category,
                    marketEndDate: market.end_date,
                    player: activeDrafter,
                    prediction,
                    session: league?.currentSession || 1,
                    pickIndex: currentPickIndex,
                    snapshotOdds,
                    currentPriceYes: market.current_price_yes,
                    currentPriceNo: market.current_price_no,
                })
            });

            if (res.ok) {
                const data = await res.json();
                const newPick = {
                    ...data.pick,
                    marketTitle: market.title
                };
                setDraftPicks(prev => [...prev, newPick]);
                setCurrentPickIndex(prev => prev + 1);
                setSelectedMarket(null);

                // In auto mode, clear selection after each pick
                if (draftMode === 'auto') {
                    setSelectedPlayer(null);
                }
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

    // Format odds as percentage
    const formatOdds = (odds: number) => {
        return `${(odds * 100).toFixed(1)}%`;
    };

    // Format odds as cents (like Polymarket displays)
    const formatCents = (odds: number) => {
        return `${(odds * 100).toFixed(0)}¢`;
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
                    <div className="flex items-center gap-4">
                        {/* Draft Mode Toggle */}
                        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
                            <button
                                onClick={() => setDraftMode('auto')}
                                className={`px-3 py-1 rounded text-sm transition ${draftMode === 'auto'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Auto Order
                            </button>
                            <button
                                onClick={() => setDraftMode('manual')}
                                className={`px-3 py-1 rounded text-sm transition ${draftMode === 'manual'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Manual Pick
                            </button>
                        </div>
                        <div className="text-sm text-gray-400">
                            Mock Draft (Real Polymarket Odds)
                        </div>
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

                    {/* Active Drafter Display */}
                    {draftMode === 'manual' && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                            <div className="text-sm text-blue-100 mb-2">Drafting for:</div>
                            <div className="text-xl font-bold">
                                {selectedPlayer
                                    ? `${selectedPlayer.slice(0, 10)}...${selectedPlayer.slice(-6)}`
                                    : '← Select a player from the list'
                                }
                            </div>
                        </div>
                    )}
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
                                {draftMode === 'manual' ? 'Select Player' : 'Draft Order'}
                            </h2>
                            <div className="space-y-2">
                                {draftOrder.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No players yet</p>
                                ) : (
                                    draftOrder.map((address, index) => {
                                        const isCurrentDrafter = address === getCurrentDrafter();
                                        const isSelected = draftMode === 'manual' && address === selectedPlayer;
                                        const playerPicks = draftPicks.filter(p => p.player === address);
                                        const maxPicks = league.marketsPerSession || 5;
                                        const isMaxed = playerPicks.length >= maxPicks;

                                        return (
                                            <div
                                                key={address}
                                                onClick={() => {
                                                    if (draftMode === 'manual' && !isMaxed) {
                                                        setSelectedPlayer(address);
                                                    }
                                                }}
                                                className={`p-3 rounded-lg transition cursor-pointer ${isSelected
                                                    ? 'bg-purple-600 ring-2 ring-purple-400'
                                                    : isCurrentDrafter && draftMode === 'auto'
                                                        ? 'bg-blue-600 ring-2 ring-blue-400'
                                                        : isMaxed
                                                            ? 'bg-gray-700/50 opacity-50'
                                                            : 'bg-gray-700 hover:bg-gray-600'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-mono text-sm">
                                                        {address.slice(0, 6)}...{address.slice(-4)}
                                                    </span>
                                                    <span className={`text-xs ${isMaxed ? 'text-green-400' : 'text-gray-300'}`}>
                                                        {playerPicks.length}/{maxPicks}
                                                        {isMaxed && ' ✓'}
                                                    </span>
                                                </div>
                                                {isCurrentDrafter && draftMode === 'auto' && !isDraftComplete && (
                                                    <div className="text-xs text-blue-200 mt-1">
                                                        ⏰ On the clock
                                                    </div>
                                                )}
                                                {isSelected && (
                                                    <div className="text-xs text-purple-200 mt-1">
                                                        ✓ Selected for drafting
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

                            {draftMode === 'manual' && (
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Click a player above to draft for them
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Markets Panel */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                <h2 className="font-bold text-lg">
                                    Polymarket Markets ({markets.length})
                                </h2>
                                <span className="text-xs text-green-400">● Live Odds</span>
                            </div>
                            {markets.length === 0 ? (
                                <p className="text-gray-400 text-center py-8">
                                    No markets available. Check API connection.
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {markets.map(market => {
                                        const yesDisabled = isMarketDrafted(market.market_id, 'YES');
                                        const noDisabled = isMarketDrafted(market.market_id, 'NO');
                                        const isSelected = selectedMarket?.market_id === market.market_id;
                                        const noPlayerSelected = draftMode === 'manual' && !selectedPlayer;

                                        return (
                                            <div
                                                key={market.market_id}
                                                className={`p-4 rounded-lg border transition cursor-pointer ${isSelected
                                                    ? 'bg-blue-900/50 border-blue-500'
                                                    : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                                                    }`}
                                                onClick={() => setSelectedMarket(market)}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <h3 className="font-medium text-sm flex-1 mr-2">
                                                        {market.title}
                                                    </h3>
                                                    <span className="text-xs bg-gray-600 px-2 py-1 rounded whitespace-nowrap">
                                                        {market.category}
                                                    </span>
                                                </div>

                                                {/* Odds Display - Like Polymarket */}
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div className={`p-2 rounded-lg text-center ${yesDisabled ? 'bg-gray-600/50' : 'bg-green-900/30 border border-green-700'
                                                        }`}>
                                                        <div className="text-xs text-gray-400 mb-1">YES</div>
                                                        <div className={`text-lg font-bold ${yesDisabled ? 'text-gray-500' : 'text-green-400'}`}>
                                                            {formatCents(market.current_price_yes)}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {formatOdds(market.current_price_yes)}
                                                        </div>
                                                    </div>
                                                    <div className={`p-2 rounded-lg text-center ${noDisabled ? 'bg-gray-600/50' : 'bg-red-900/30 border border-red-700'
                                                        }`}>
                                                        <div className="text-xs text-gray-400 mb-1">NO</div>
                                                        <div className={`text-lg font-bold ${noDisabled ? 'text-gray-500' : 'text-red-400'}`}>
                                                            {formatCents(market.current_price_no)}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {formatOdds(market.current_price_no)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        disabled={yesDisabled || isDraftComplete || drafting || draftOrder.length === 0 || noPlayerSelected}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDraftPick(market, 'YES');
                                                        }}
                                                        className={`flex-1 px-3 py-2 rounded text-sm font-bold transition ${yesDisabled || isDraftComplete || draftOrder.length === 0 || noPlayerSelected
                                                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                            : 'bg-green-600 hover:bg-green-500'
                                                            }`}
                                                    >
                                                        {yesDisabled ? '✓ YES Drafted' : `Draft YES @ ${formatCents(market.current_price_yes)}`}
                                                    </button>
                                                    <button
                                                        disabled={noDisabled || isDraftComplete || drafting || draftOrder.length === 0 || noPlayerSelected}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDraftPick(market, 'NO');
                                                        }}
                                                        className={`flex-1 px-3 py-2 rounded text-sm font-bold transition ${noDisabled || isDraftComplete || draftOrder.length === 0 || noPlayerSelected
                                                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                            : 'bg-red-600 hover:bg-red-500'
                                                            }`}
                                                    >
                                                        {noDisabled ? '✓ NO Drafted' : `Draft NO @ ${formatCents(market.current_price_no)}`}
                                                    </button>
                                                </div>

                                                {/* Market Meta */}
                                                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                                                    <span>Vol: ${(market.volume / 1000).toFixed(0)}k</span>
                                                    <span>Ends: {new Date(market.end_date).toLocaleDateString()}</span>
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
                                            key={pick.id || index}
                                            className="p-3 bg-gray-700/50 rounded-lg"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-mono text-xs text-gray-300">
                                                    {pick.player.slice(0, 8)}...
                                                </span>
                                                <span className={`px-2 py-0.5 rounded font-bold text-xs ${pick.prediction === 'YES'
                                                    ? 'bg-green-600'
                                                    : 'bg-red-600'
                                                    }`}>
                                                    {pick.prediction}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-300 mb-1">
                                                {pick.marketTitle || marketTitles[pick.marketId] || pick.marketId.slice(0, 20) + '...'}
                                            </div>
                                            {pick.snapshotOdds && (
                                                <div className="text-xs text-gray-500">
                                                    Drafted @ {(pick.snapshotOdds / 100).toFixed(1)}%
                                                </div>
                                            )}
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
