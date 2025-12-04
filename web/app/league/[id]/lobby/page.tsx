'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

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
            }

            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        fetchData();
        // Poll for updates
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Redirect if draft already started
    useEffect(() => {
        if (league?.status === 'DRAFTING' || league?.status === 'ACTIVE') {
            router.push(`/league/${params.id}/draft`);
        }
    }, [league?.status, params.id, router]);

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

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
                <div className="container mx-auto px-4 py-4">
                    <Link href="/" className="text-xl font-bold hover:text-blue-400">← Back to Home</Link>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-12 max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-start mb-2">
                        <h1 className="text-4xl font-bold">{league.name}</h1>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${league.status === 'SETUP' ? 'bg-yellow-600' :
                                league.status === 'DRAFTING' ? 'bg-blue-600' :
                                    league.status === 'ACTIVE' ? 'bg-green-600' : 'bg-gray-600'
                            }`}>
                            {league.status}
                        </span>
                    </div>
                    <p className="text-gray-400">
                        {league.status === 'SETUP'
                            ? 'Waiting for players to join'
                            : league.status === 'DRAFTING'
                                ? 'Draft in progress!'
                                : 'Season in progress'}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* League Details */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="font-semibold mb-4 text-lg">League Details</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Buy-in:</span>
                                <span className="font-medium">{league.buyIn} {league.currency}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Players:</span>
                                <span className="font-medium">{players.length}/{league.maxPlayers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Sessions:</span>
                                <span className="font-medium">{league.totalSessions}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Markets per Session:</span>
                                <span className="font-medium">{league.marketsPerSession || 5}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-700 pt-3 mt-3">
                                <span className="text-gray-400">Prize Pool:</span>
                                <span className="font-bold text-green-400">{prizePool} {league.currency}</span>
                            </div>
                        </div>
                    </div>

                    {/* Invite Link */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="font-semibold mb-4 text-lg">Share Invite Link</h3>
                        <div className="bg-gray-900 p-3 rounded-lg font-mono text-sm break-all text-gray-300">
                            {typeof window !== 'undefined' ? `${window.location.origin}/league/join/${league.leagueId}` : 'Loading...'}
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/league/join/${league.leagueId}`);
                                alert('Copied to clipboard!');
                            }}
                            className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
                        >
                            📋 Copy Link
                        </button>
                    </div>
                </div>

                {/* Players List */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8">
                    <h3 className="font-semibold mb-4 text-lg">
                        Players ({players.length}/{league.maxPlayers})
                    </h3>
                    {players.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">
                            No players yet. Share the invite link to get started!
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {players.map((player, index) => {
                                const isMe = publicKey && player.address === publicKey.toBase58();
                                const isLeagueCreator = player.address === league.creator;

                                return (
                                    <div
                                        key={player.id}
                                        className={`flex items-center justify-between p-3 rounded-lg ${isMe ? 'bg-purple-900/30 border border-purple-600' : 'bg-gray-700/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-500 text-sm w-6">{index + 1}.</span>
                                            <div>
                                                <span className="font-mono text-sm">
                                                    {player.address.slice(0, 6)}...{player.address.slice(-4)}
                                                </span>
                                                <div className="flex gap-2 mt-1">
                                                    {isMe && (
                                                        <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">You</span>
                                                    )}
                                                    {isLeagueCreator && (
                                                        <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded">Creator</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-green-400">✓ Paid</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-4">
                    {/* Start Draft Button - Only for Creator */}
                    {isCreator && league.status === 'SETUP' && (
                        <button
                            onClick={handleStartDraft}
                            disabled={!canStartDraft || starting}
                            className={`w-full py-4 rounded-xl text-lg font-bold transition ${canStartDraft && !starting
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {starting
                                ? '🔄 Starting Draft...'
                                : players.length < 2
                                    ? `⏳ Waiting for Players (${players.length}/2 minimum)`
                                    : '🚀 Start Draft'}
                        </button>
                    )}

                    {/* Non-creator waiting message */}
                    {!isCreator && league.status === 'SETUP' && (
                        <div className="text-center py-4 bg-gray-800 rounded-xl border border-gray-700">
                            <p className="text-gray-400">
                                ⏳ Waiting for the league creator to start the draft...
                            </p>
                        </div>
                    )}

                    {/* Go to Draft Button - If already drafting */}
                    {(league.status === 'DRAFTING' || league.status === 'ACTIVE') && (
                        <button
                            onClick={() => router.push(`/league/${params.id}/draft`)}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-lg font-bold transition"
                        >
                            📊 Go to Draft Room
                        </button>
                    )}

                    <p className="text-sm text-gray-500 text-center">
                        {league.status === 'SETUP'
                            ? 'Minimum 2 players required to start (8 recommended for best experience)'
                            : 'Draft order is randomized when the draft starts'}
                    </p>
                </div>
            </div>
        </div>
    );
}
