'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import LeaderboardTable from '@/components/league/LeaderboardTable';
import ActivePicksPanel from '@/components/league/ActivePicksPanel';

interface Player {
    id: number;
    address: string;
    points: number;
    streak: number;
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

export default function LeagueLobby() {
    const params = useParams();
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    // Fetch live scores
    const [scores, setScores] = useState<any>(null);

    const fetchData = useCallback(async () => {
        if (!params.id) return;

        try {
            // Fetch league
            const leagueRes = await fetch(`/api/leagues?id=${params.id}`);
            const leagueData = await leagueRes.json();
            const leagueInfo = Array.isArray(leagueData) ? leagueData[0] : leagueData;
            setLeague(leagueInfo);

            // Fetch players
            if (leagueInfo?.id) {
                const playersRes = await fetch(`/api/leagues/${leagueInfo.id}/players`);
                if (playersRes.ok) {
                    const playersData = await playersRes.json();
                    setPlayers(playersData.players || []);
                }

                // Fetch live scores if active or drafting
                if (leagueInfo.status === 'ACTIVE' || leagueInfo.status === 'DRAFTING') {
                    const scoresRes = await fetch(`/api/scores/live?league_id=${leagueInfo.id}`);
                    const scoresData = await scoresRes.json();
                    setScores(scoresData);
                }
            }

            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const isCreator = connected && publicKey && league?.creator === publicKey.toBase58();
    const canStartDraft = isCreator && players.length >= 2 && league?.status === 'SETUP';

    const handleStartDraft = async () => {
        if (!canStartDraft || !publicKey) return;
        setStarting(true);
        try {
            const res = await fetch('/api/draft/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId: league?.leagueId || params.id,
                    creator: publicKey.toBase58()
                })
            });

            if (res.ok) {
                router.push(`/league/${params.id}/draft`);
            } else {
                const error = await res.json();
                alert(`Failed to start draft: ${error.error}`);
            }
        } catch (error) {
            console.error('Start draft error:', error);
            alert('Failed to start draft');
        }
        setStarting(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
                <div className="text-white text-xl">Loading Lobby...</div>
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

    const prizePool = league.buyIn * players.length;
    const isSetup = league.status === 'SETUP';

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/" className="text-xl font-bold hover:text-blue-400">
                        🏠 Home
                    </Link>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">{league.name}</h1>
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${league.status === 'SETUP' ? 'bg-yellow-600' :
                                league.status === 'DRAFTING' ? 'bg-blue-600' :
                                    'bg-green-600'
                                }`}>
                                {league.status}
                            </span>
                            <span className="text-gray-400">
                                {league.currentPlayers}/{league.maxPlayers} Players
                            </span>
                            <span className="text-green-400 font-bold">
                                {prizePool} {league.currency} Pool
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Link
                            href={`/league/${params.id}/mock-draft`}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition shadow-lg shadow-purple-900/20"
                        >
                            🧪 Mock Draft
                        </Link>
                        {league.status === 'DRAFTING' && (
                            <Link
                                href={`/league/${params.id}/draft`}
                                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-bold transition shadow-lg shadow-green-900/20"
                            >
                                🎯 Enter Draft Room
                            </Link>
                        )}
                        {isCreator && isSetup && (
                            <button
                                onClick={handleStartDraft}
                                disabled={!canStartDraft || starting}
                                className={`px-6 py-3 rounded-xl font-bold transition ${canStartDraft && !starting
                                    ? 'bg-blue-600 hover:bg-blue-500'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {starting ? 'Starting...' : '🚀 Start Draft'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid lg:grid-cols-3 gap-8">

                    {/* Left Column: Dashboard / Stats (Span 2) */}
                    <div className="lg:col-span-2 space-y-8">
                        {!isSetup ? (
                            <>
                                {/* Live Leaderboard */}
                                <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                                    <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                        <h2 className="text-xl font-bold">🏆 Live Standings</h2>
                                        <span className="text-xs text-gray-400 animate-pulse">● Live Updates</span>
                                    </div>
                                    <LeaderboardTable
                                        players={scores?.players || []}
                                        currentPlayerAddress={publicKey?.toBase58()}
                                    />
                                </div>

                                {/* Active Picks */}
                                {publicKey && (
                                    <ActivePicksPanel
                                        leagueId={params.id as string}
                                        playerAddress={publicKey.toBase58()}
                                    />
                                )}
                            </>
                        ) : (
                            /* Setup State: Show Players List */
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                                <h3 className="font-semibold mb-4 text-lg">
                                    Joined Players ({players.length}/{league.maxPlayers})
                                </h3>
                                {players.length === 0 ? (
                                    <p className="text-gray-400 text-center py-8">
                                        Waiting for players to join...
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {players.map((player, index) => {
                                            const isMe = publicKey && player.address === publicKey.toBase58();
                                            return (
                                                <div key={player.id} className={`flex items-center justify-between p-3 rounded-lg ${isMe ? 'bg-purple-900/30 border border-purple-600' : 'bg-gray-700/50'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-gray-500 w-6">{index + 1}.</span>
                                                        <span className="font-mono">{player.address.slice(0, 6)}...{player.address.slice(-4)}</span>
                                                        {isMe && <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">You</span>}
                                                        {player.address === league.creator && <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded">Creator</span>}
                                                    </div>
                                                    <span className="text-green-400 text-sm">✓ Ready</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: League Info & Invite */}
                    <div className="space-y-6">
                        {/* Invite Card */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <h3 className="font-semibold mb-4">Invite Friends</h3>
                            <div className="bg-gray-900 p-3 rounded-lg font-mono text-xs break-all text-gray-400 mb-3">
                                {typeof window !== 'undefined'
                                    ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/league/join/${league.leagueId}`
                                    : '...'}
                            </div>
                            <button
                                onClick={() => {
                                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                                    navigator.clipboard.writeText(`${baseUrl}/league/join/${league.leagueId}`);
                                    alert('Copied!');
                                }}
                                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
                            >
                                📋 Copy Link
                            </button>
                        </div>

                        {/* League Details */}
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                            <h3 className="font-semibold mb-4">League Settings</h3>
                            <div className="space-y-3 text-sm text-gray-300">
                                <div className="flex justify-between">
                                    <span>Buy-in</span>
                                    <span className="text-white">{league.buyIn} {league.currency}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Total Sessions</span>
                                    <span className="text-white">{league.totalSessions}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Markets/Session</span>
                                    <span className="text-white">{league.marketsPerSession}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Current Session</span>
                                    <span className="text-white">{league.currentSession}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
