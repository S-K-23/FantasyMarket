'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

interface Market {
    id: string;
    question: string;
    category: string;
    probability: number;
    endDate: string;
}

interface DraftPick {
    id: number;
    marketId: string;
    player: string;
    prediction: string;
    isResolved: boolean;
    points: number | null;
    market?: Market;
}

export default function LeagueAdminPage() {
    const params = useParams();
    const router = useRouter();
    const { publicKey, connected } = useWallet();

    const [league, setLeague] = useState<any>(null);
    const [picks, setPicks] = useState<DraftPick[]>([]);
    const [markets, setMarkets] = useState<Record<string, Market>>({});
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);

    useEffect(() => {
        if (!params.id || !connected) return;

        const fetchData = async () => {
            try {
                // Fetch league
                const leagueRes = await fetch(`/api/leagues?id=${params.id}`);
                const leagueData = await leagueRes.json();
                const leagueInfo = Array.isArray(leagueData) ? leagueData[0] : leagueData;
                setLeague(leagueInfo);

                // Check if creator
                if (publicKey && leagueInfo.creator !== publicKey.toBase58()) {
                    alert('Only the league creator can access this page');
                    router.push(`/league/${params.id}/lobby`);
                    return;
                }

                // Fetch picks
                const picksRes = await fetch(`/api/draft/picks?leagueId=${leagueInfo.id}`);
                const picksData = await picksRes.json();
                setPicks(picksData.picks || []);

                // Fetch market details for these picks
                const uniqueMarketIds = [...new Set((picksData.picks || []).map((p: any) => p.marketId))];
                if (uniqueMarketIds.length > 0) {
                    const marketsRes = await fetch('/api/markets?limit=100'); // Ideally fetch specific IDs
                    const marketsData = await marketsRes.json();
                    const marketsMap: Record<string, Market> = {};
                    marketsData.forEach((m: Market) => {
                        marketsMap[m.id] = m;
                    });
                    setMarkets(marketsMap);
                }

                setLoading(false);
            } catch (err) {
                console.error('Failed to load admin data:', err);
                setLoading(false);
            }
        };

        fetchData();
    }, [params.id, connected, publicKey, router]);

    const handleResolve = async (marketId: string, outcome: 'YES' | 'NO') => {
        if (!confirm(`Are you sure you want to resolve this market as ${outcome}? This will calculate points for all players.`)) return;

        setResolving(marketId);
        try {
            const res = await fetch('/api/cron/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId,
                    forceOutcome: outcome
                })
            });

            if (!res.ok) throw new Error('Failed to resolve');

            const data = await res.json();
            alert(`Successfully resolved! ${data.results.length} picks updated.`);

            // Refresh data
            window.location.reload();
        } catch (err) {
            console.error('Resolution error:', err);
            alert('Failed to resolve market');
        } finally {
            setResolving(null);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading Admin Panel...</div>;

    // Group picks by market
    const picksByMarket: Record<string, DraftPick[]> = {};
    picks.forEach(pick => {
        if (!picksByMarket[pick.marketId]) picksByMarket[pick.marketId] = [];
        picksByMarket[pick.marketId].push(pick);
    });

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">👮‍♂️ Commissioner Tools</h1>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-blue-400 hover:underline">
                            🏠 Home
                        </Link>
                        <span className="text-gray-600">|</span>
                        <Link href={`/league/${params.id}/lobby`} className="text-blue-400 hover:underline">
                            Back to Lobby
                        </Link>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
                    <h2 className="text-xl font-bold mb-4">Manual Market Resolution</h2>
                    <p className="text-gray-400 mb-6">
                        Use this to manually resolve markets for testing purposes. In production, this happens automatically via Chainlink/Polymarket oracles.
                    </p>

                    <div className="space-y-4">
                        {Object.entries(picksByMarket).map(([marketId, marketPicks]) => {
                            const market = markets[marketId];
                            const isResolved = marketPicks.every(p => p.isResolved);

                            return (
                                <div key={marketId} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg">{market?.question || marketId}</h3>
                                            <p className="text-sm text-gray-400">{market?.category}</p>
                                        </div>
                                        {isResolved ? (
                                            <span className="bg-green-600/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">
                                                ✅ Resolved
                                            </span>
                                        ) : (
                                            <span className="bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold">
                                                ⏳ Pending
                                            </span>
                                        )}
                                    </div>

                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Picks on this market:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {marketPicks.map(pick => (
                                                <span key={pick.id} className={`px-2 py-1 rounded text-xs border ${pick.prediction === 'YES' ? 'border-green-600/50 bg-green-900/20' : 'border-red-600/50 bg-red-900/20'
                                                    }`}>
                                                    {pick.player.slice(0, 4)}...{pick.player.slice(-4)}:
                                                    <strong className={pick.prediction === 'YES' ? 'text-green-400' : 'text-red-400'}> {pick.prediction}</strong>
                                                    {pick.isResolved && <span className="ml-1 text-gray-400">({pick.points} pts)</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {!isResolved && (
                                        <div className="flex gap-4 border-t border-gray-600 pt-4">
                                            <button
                                                onClick={() => handleResolve(marketId, 'YES')}
                                                disabled={!!resolving}
                                                className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded font-bold disabled:opacity-50"
                                            >
                                                Resolve YES
                                            </button>
                                            <button
                                                onClick={() => handleResolve(marketId, 'NO')}
                                                disabled={!!resolving}
                                                className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded font-bold disabled:opacity-50"
                                            >
                                                Resolve NO
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Payout Distribution Section */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-bold mb-4">💰 Distribute Payouts</h2>
                    <p className="text-gray-400 mb-6">
                        Once all markets are resolved and the season is over, distribute payouts to players based on their points share.
                    </p>

                    <div className="bg-gray-900/50 p-4 rounded-lg mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400">Total Prize Pool:</span>
                            <span className="font-bold text-xl text-green-400">
                                {(league?.buyIn || 0) * (league?.currentPlayers || 0)} {league?.currency || 'SOL'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Status:</span>
                            <span className={`font-bold ${league?.status === 'COMPLETED' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {league?.status}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            if (!confirm('Are you sure you want to distribute payouts? This is irreversible.')) return;
                            setResolving('payout');
                            try {
                                const res = await fetch('/api/admin/distribute', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ leagueId: league.leagueId })
                                });
                                const data = await res.json();
                                if (data.error) throw new Error(data.error);
                                alert(`Payouts distributed! Total: ${data.totalPrizePool} ${league.currency}`);
                                window.location.reload();
                            } catch (e: any) {
                                alert(`Error: ${e.message}`);
                            } finally {
                                setResolving(null);
                            }
                        }}
                        disabled={!!resolving || league?.status === 'COMPLETED'}
                        className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {league?.status === 'COMPLETED' ? '✅ Payouts Distributed' : '💸 Distribute Payouts'}
                    </button>
                </div>
            </div>
        </div>
    );
}
