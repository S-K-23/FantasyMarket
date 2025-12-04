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
        <div className="min-h-screen bg-gradient-to-b from-background to-muted">
            <nav className="border-b">
                <div className="container mx-auto px-4 py-4">
                    <Link href="/" className="text-xl font-bold">← Back to Home</Link>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-12">
                <h1 className="text-4xl font-bold mb-8">Browse Leagues</h1>

                {loading ? (
                    <p>Loading leagues...</p>
                ) : leagues.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground mb-4">No leagues yet.</p>
                        <Link
                            href="/league/create"
                            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
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
                                className="bg-card p-6 rounded-lg border hover:border-primary transition-colors"
                            >
                                <h3 className="text-xl font-semibold mb-2">{league.name}</h3>
                                <div className="space-y-1 text-sm text-muted-foreground">
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
