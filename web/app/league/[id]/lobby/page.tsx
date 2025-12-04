'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

export default function LeagueLobby() {
    const params = useParams();
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const [league, setLeague] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetch(`/api/leagues?id=${params.id}`)
                .then(res => res.json())
                .then(data => {
                    setLeague(Array.isArray(data) ? data[0] : data);
                    setLoading(false);
                })
                .catch(error => {
                    console.error('Failed to fetch league:', error);
                    setLoading(false);
                });
        }
    }, [params.id]);

    const handleStartDraft = () => {
        router.push(`/league/${params.id}/draft`);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!league) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">League Not Found</h1>
                    <Link href="/" className="text-primary">Go Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted">
            <nav className="border-b">
                <div className="container mx-auto px-4 py-4">
                    <Link href="/" className="text-xl font-bold">← Back to Home</Link>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <h1 className="text-4xl font-bold mb-2">{league.name}</h1>
                <p className="text-muted-foreground mb-8">Waiting for players to join</p>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-card p-6 rounded-lg border">
                        <h3 className="font-semibold mb-4">League Details</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Buy-in:</span>
                                <span className="font-medium">{league.buyIn} {league.currency}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Players:</span>
                                <span className="font-medium">{league.currentPlayers}/{league.maxPlayers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Sessions:</span>
                                <span className="font-medium">{league.totalSessions}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Prize Pool:</span>
                                <span className="font-medium">{league.buyIn * league.currentPlayers} {league.currency}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card p-6 rounded-lg border">
                        <h3 className="font-semibold mb-4">Invite Code</h3>
                        <div className="bg-muted p-3 rounded font-mono text-sm break-all">
                            {`${window.location.origin}/league/join/${params.id}`}
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/league/join/${params.id}`);
                                alert('Copied to clipboard!');
                            }}
                            className="mt-2 text-sm text-primary hover:underline"
                        >
                            Copy Link
                        </button>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-lg border mb-8">
                    <h3 className="font-semibold mb-4">Players</h3>
                    {league.currentPlayers === 0 ? (
                        <p className="text-sm text-muted-foreground">No players yet. Share the invite link!</p>
                    ) : (
                        <div className="space-y-2">
                            {/* In a real app, we'd fetch and display player list */}
                            <p className="text-sm text-muted-foreground">{league.currentPlayers} player(s) joined</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleStartDraft}
                        disabled={league.currentPlayers < 2}
                        className="h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                        {league.currentPlayers < 2 ? 'Waiting for Players' : 'Start Draft'}
                    </button>
                    <p className="text-sm text-muted-foreground self-center">
                        Minimum 2 players required (8 recommended)
                    </p>
                </div>
            </div>
        </div>
    );
}
