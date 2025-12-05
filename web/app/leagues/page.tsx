'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Leagues() {
    const [leagues, setLeagues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/leagues')
            .then(res => res.json())
            .then(data => {
                setLeagues(data);
                setLoading(false);
            })
            .catch(error => {
                console.error('Failed to fetch leagues:', error);
                setLoading(false);
            });
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
                <div className="container mx-auto px-4 py-4">
                    <Link href="/" className="text-xl font-bold hover:text-blue-400">← Back to Home</Link>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-12">
                <h1 className="text-4xl font-bold mb-8">Browse Leagues</h1>

                {loading ? (
                    <p className="text-gray-400">Loading leagues...</p>
                ) : leagues.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-400 mb-4">No leagues yet.</p>
                        <Link
                            href="/league/create"
                            className="inline-flex h-11 items-center justify-center rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-8 text-sm font-medium text-white shadow-lg hover:from-blue-500 hover:to-purple-500 transition-all"
                        >
                            Create the First League
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {leagues.map((league) => (
                            <Link
                                key={league.id}
                                href={`/league/${league.id}/lobby`}
                                className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-gray-500 transition-all group"
                            >
                                <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition">{league.name}</h3>
                                <div className="space-y-1 text-sm text-gray-400">
                                    <p>Buy-in: {league.buyIn} {league.currency}</p>
                                    <p>Players: {league.currentPlayers}/{league.maxPlayers}</p>
                                    <p>Sessions: {league.totalSessions}</p>
                                    <p>Status: <span className="capitalize">{league.status.toLowerCase()}</span></p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
