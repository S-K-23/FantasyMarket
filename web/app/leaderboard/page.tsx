'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

interface LeaderboardEntry {
    id: number;
    address: string;
    elo: number;
    wins: number;
    losses: number;
    rank: number;
}

export default function LeaderboardPage() {
    const { publicKey } = useWallet();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch('/api/leaderboard?limit=100');
                const data = await res.json();
                setLeaderboard(data);

                // Find current user's rank
                if (publicKey) {
                    const userEntry = data.find((e: LeaderboardEntry) => e.address === publicKey.toString());
                    setUserRank(userEntry || null);
                }
            } catch (error) {
                console.error('Failed to fetch leaderboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [publicKey]);

    const formatAddress = (address: string) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    const getEloColor = (elo: number) => {
        if (elo >= 1500) return 'text-yellow-400'; // Gold
        if (elo >= 1200) return 'text-purple-400'; // Purple
        if (elo >= 1000) return 'text-blue-400';   // Blue
        return 'text-gray-400';                     // Gray
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <Link href="/" className="text-xl font-bold hover:text-blue-400">← Back to Home</Link>
                    <h1 className="text-xl font-bold">🏆 Global Leaderboard</h1>
                    <div className="w-24"></div>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* User's Current Rank */}
                {userRank && (
                    <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-6 mb-8">
                        <h2 className="text-sm text-gray-400 mb-2">Your Ranking</h2>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-3xl">{getRankBadge(userRank.rank)}</span>
                                <div>
                                    <div className="font-bold">{formatAddress(userRank.address)}</div>
                                    <div className="text-sm text-gray-400">
                                        {userRank.wins}W - {userRank.losses}L
                                    </div>
                                </div>
                            </div>
                            <div className={`text-3xl font-bold ${getEloColor(userRank.elo)}`}>
                                {userRank.elo} ELO
                            </div>
                        </div>
                    </div>
                )}

                {/* Leaderboard Table */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="text-lg font-bold">Top Players</h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading...</div>
                    ) : leaderboard.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <p className="text-xl mb-2">No players yet</p>
                            <p className="text-sm">Complete a 1v1 duel to appear on the leaderboard!</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Rank</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Player</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">W/L</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">ELO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((entry, index) => {
                                    const isCurrentUser = publicKey?.toString() === entry.address;
                                    return (
                                        <tr
                                            key={entry.id}
                                            className={`border-t border-gray-700 ${isCurrentUser ? 'bg-purple-900/30' : 'hover:bg-gray-700/30'
                                                }`}
                                        >
                                            <td className="px-4 py-4 text-lg">
                                                {getRankBadge(entry.rank)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={isCurrentUser ? 'text-purple-300' : ''}>
                                                    {formatAddress(entry.address)}
                                                    {isCurrentUser && <span className="ml-2 text-xs text-purple-400">(You)</span>}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="text-green-400">{entry.wins}</span>
                                                <span className="text-gray-500"> / </span>
                                                <span className="text-red-400">{entry.losses}</span>
                                            </td>
                                            <td className={`px-4 py-4 text-right font-bold ${getEloColor(entry.elo)}`}>
                                                {entry.elo}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ELO Tier Legend */}
                <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <h3 className="font-semibold mb-4">ELO Tiers</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <span>Gold (1500+)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                            <span>Purple (1200+)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                            <span>Blue (1000+)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                            <span>Gray (&lt;1000)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
