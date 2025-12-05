'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import LeaderboardTable from '@/components/league/LeaderboardTable';
import ActivePicksPanel from '@/components/league/ActivePicksPanel';

interface ScoresData {
    league_id: number;
    session_index: number | null;
    updated_at: string;
    players: any[];
}

interface LeagueData {
    id: number;
    leagueId: string;
    name: string;
    currentSession: number;
    totalSessions: number;
    buyIn: number;
    currency: string;
    maxPlayers: number;
}

export default function DashboardPage() {
    const params = useParams();
    const { publicKey } = useWallet();
    const [scores, setScores] = useState<ScoresData | null>(null);
    const [league, setLeague] = useState<LeagueData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!params.id) return;

        const fetchData = async () => {
            try {
                // Fetch league info
                const leagueRes = await fetch(`/api/leagues?id=${params.id}`);
                const leagueData = await leagueRes.json();
                const leagueInfo = Array.isArray(leagueData) ? leagueData[0] : leagueData;
                setLeague(leagueInfo);

                // Fetch live scores
                const scoresRes = await fetch(`/api/scores/live?league_id=${params.id}`);
                const scoresData = await scoresRes.json();
                setScores(scoresData);

                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                setLoading(false);
            }
        };

        fetchData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [params.id]);

    const currentPlayer = scores?.players.find(
        p => publicKey && p.player_address === publicKey.toBase58()
    );

    const prizePool = league ? league.buyIn * league.maxPlayers : 0;
    const yourShare = currentPlayer ? prizePool * currentPlayer.prize_share : 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
                <div className="text-white text-xl">Loading Dashboard...</div>
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
                        <span className="text-sm text-gray-400">
                            Live scores update every 30s
                        </span>
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-8 space-y-6">
                {/* League Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">{league?.name}</h1>
                        <p className="text-gray-400">
                            Session {league?.currentSession} of {league?.totalSessions}
                        </p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">Total Prize Pool</p>
                        <p className="text-2xl font-bold">
                            {prizePool} {league?.currency}
                        </p>
                        {currentPlayer && (
                            <p className="text-sm text-green-400 mt-2">
                                Your projected: {yourShare.toFixed(2)} {league?.currency}
                            </p>
                        )}
                    </div>
                </div>

                {/* Your Score Highlight */}
                {currentPlayer && (
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm opacity-80">Your Rank</p>
                                <p className="text-4xl font-bold">#{currentPlayer.rank}</p>
                            </div>
                            <div>
                                <p className="text-sm opacity-80">Total Score</p>
                                <p className="text-4xl font-bold">{currentPlayer.total_score.toFixed(1)}</p>
                                <p className="text-xs opacity-70">
                                    {currentPlayer.live_score >= 0 ? '+' : ''}{currentPlayer.live_score.toFixed(1)} live
                                </p>
                            </div>
                            <div>
                                <p className="text-sm opacity-80">Record</p>
                                <p className="text-4xl font-bold">
                                    {currentPlayer.wins}-{currentPlayer.losses}
                                </p>
                                {currentPlayer.pending > 0 && (
                                    <p className="text-xs opacity-70">
                                        {currentPlayer.pending} pending
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-sm opacity-80">Prize Share</p>
                                <p className="text-4xl font-bold">
                                    {(currentPlayer.prize_share * 100).toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Standings Table */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Standings</h2>
                        <span className="text-sm text-gray-400">
                            Last updated: {scores?.updated_at ? new Date(scores.updated_at).toLocaleTimeString() : '—'}
                        </span>
                    </div>
                    <LeaderboardTable
                        players={scores?.players || []}
                        currentPlayerAddress={publicKey?.toBase58()}
                    />
                </div>

                {/* Active Picks Panel */}
                {currentPlayer && publicKey && (
                    <ActivePicksPanel
                        leagueId={params.id as string}
                        playerAddress={publicKey.toBase58()}
                    />
                )}

                {/* Quick Actions */}
                <div className="grid md:grid-cols-3 gap-4">
                    <Link
                        href={`/league/${params.id}/draft`}
                        className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center transition"
                    >
                        <h3 className="font-bold text-lg mb-2">📝 Draft</h3>
                        <p className="text-sm text-gray-400">Make your picks</p>
                    </Link>
                    <Link
                        href={`/league/${params.id}/lobby`}
                        className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-center transition"
                    >
                        <h3 className="font-bold text-lg mb-2">👥 Lobby</h3>
                        <p className="text-sm text-gray-400">View league info</p>
                    </Link>
                    {currentPlayer && (
                        <div className="bg-gray-800 rounded-xl p-6 text-center">
                            <h3 className="font-bold text-lg mb-2">🎯 Your Picks</h3>
                            <p className="text-sm text-gray-400">
                                {currentPlayer.wins + currentPlayer.losses + currentPlayer.pending} total
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
