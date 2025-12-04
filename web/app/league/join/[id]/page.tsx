'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';
import { joinLeague } from '@/lib/program';

// Centralized Treasury Wallet (Hardcoded for MVP/Hackathon as per user request)
// In production, this should be an env var or derived.
// Using a random public key for demo if not provided.
const TREASURY_WALLET = new PublicKey("7CmuA67D5XNTE2YvFcNVPizVVvYYDsaSvP5hWgrC3k8A");

export default function JoinLeaguePage() {
    const params = useParams();
    const router = useRouter();
    const { connection } = useConnection();
    const wallet = useWallet();

    const [league, setLeague] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (params.id) {
            fetchLeague(params.id as string);
        }
    }, [params.id]);

    const fetchLeague = async (id: string) => {
        try {
            const res = await fetch(`/api/leagues/${id}`);
            if (!res.ok) throw new Error('League not found');
            const data = await res.json();
            setLeague(data);
        } catch (err) {
            setError('Failed to load league details');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!wallet.connected || !wallet.publicKey) {
            alert('Please connect your wallet');
            return;
        }

        setJoining(true);
        try {
            let txSignature = 'db-only-' + Date.now();

            // Try on-chain transaction (skip if program not deployed)
            try {
                const leagueIdOnChain = parseInt(league.leagueId.replace('league_', ''));
                console.log("Attempting on-chain join:", leagueIdOnChain);

                const tx = await joinLeague(
                    wallet,
                    connection,
                    leagueIdOnChain,
                    TREASURY_WALLET
                );
                txSignature = tx;
                console.log("On-chain transaction successful:", tx);
            } catch (chainError: any) {
                console.warn("On-chain transaction failed (program may not be deployed):", chainError?.message || chainError);
                // Continue with DB-only join for hackathon demo
            }

            // Sync with Backend (always do this)
            const res = await fetch('/api/league/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId: league.leagueId,
                    player: wallet.publicKey.toString(),
                    signature: txSignature
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to sync join');
            }

            // Redirect to Lobby
            router.push(`/league/${league.id}/lobby`);
        } catch (err: any) {
            console.error("Join error:", err);
            alert(`Failed to join league: ${err.message || 'Unknown error'}`);
        } finally {
            setJoining(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading league details...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!league) return <div className="p-8 text-center">League not found</div>;

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted p-8">
            <div className="max-w-md mx-auto bg-card border rounded-lg p-6 shadow-lg">
                <h1 className="text-3xl font-bold mb-2">{league.name}</h1>
                <p className="text-muted-foreground mb-6">Hosted by {league.creator.slice(0, 6)}...{league.creator.slice(-4)}</p>

                <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b pb-2">
                        <span>Buy-in</span>
                        <span className="font-bold">{league.buyIn} {league.currency}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span>Players</span>
                        <span>{league.currentPlayers} / {league.maxPlayers}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span>Sessions</span>
                        <span>{league.totalSessions}</span>
                    </div>
                </div>

                {wallet.connected ? (
                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50"
                    >
                        {joining ? 'Processing...' : `Pay ${league.buyIn} ${league.currency} to Join`}
                    </button>
                ) : (
                    <div className="text-center p-4 bg-muted rounded-md">
                        Please connect your wallet to join.
                    </div>
                )}

                <div className="mt-4 text-center">
                    <Link href="/" className="text-sm text-muted-foreground hover:underline">Cancel</Link>
                </div>
            </div>
        </div>
    );
}
