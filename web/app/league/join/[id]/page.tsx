'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

// Centralized Treasury Wallet (Hardcoded for MVP/Hackathon as per user request)
// In production, this should be an env var or derived.
// Using a random public key for demo if not provided.
const TREASURY_WALLET = new PublicKey("FgJ2LzyejgtyZeeU2GdHuykS4br5fcK5wQexZaAoRKaA");

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
        const fetchLeague = async () => {
            try {
                const res = await fetch(`/api/leagues/${params.id}`);
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

        if (params.id) {
            fetchLeague();
        }
    }, [params.id]);

    // Check if already joined
    useEffect(() => {
        if (league && wallet.connected && wallet.publicKey) {
            console.log("Checking if user is already in league...");
            console.log("Wallet:", wallet.publicKey.toBase58());
            console.log("League Players:", league.players);

            const isMember = league.players?.some((p: any) => {
                const match = p.address === wallet.publicKey?.toBase58();
                console.log(`Checking ${p.address} vs ${wallet.publicKey?.toBase58()}: ${match}`);
                return match;
            });

            if (isMember) {
                console.log("User is a member, redirecting...");
                router.push(`/league/${league.leagueId}/lobby`);
            } else {
                console.log("User is NOT a member.");
            }
        } else {
            console.log("Waiting for league data or wallet connection...", {
                hasLeague: !!league,
                connected: wallet.connected,
                hasKey: !!wallet.publicKey
            });
        }
    }, [league, wallet.connected, wallet.publicKey, router]);

    const handleJoin = async () => {
        if (!wallet.connected || !wallet.publicKey) {
            alert('Please connect your wallet');
            return;
        }

        setJoining(true);
        try {
            let txSignature = 'db-only-' + Date.now();

            // Try on-chain transaction (skip if program not deployed)
            // Try on-chain transaction (skip if program not deployed)
            try {
                const leagueIdOnChain = parseInt(league.leagueId.replace('league_', ''));
                console.log("Attempting on-chain join:", leagueIdOnChain);

                // Dynamic import to avoid loading Anchor on page load
                const { joinLeague } = await import('@/lib/program');
                const tx = await joinLeague(
                    wallet,
                    connection,
                    leagueIdOnChain,
                    TREASURY_WALLET
                );
                txSignature = tx;
                console.log("On-chain transaction successful:", tx);
            } catch (chainError: any) {
                console.warn("On-chain program failed, attempting direct SOL transfer fallback:", chainError?.message || chainError);

                // FALLBACK: Direct SOL Transfer
                try {
                    const transaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: wallet.publicKey,
                            toPubkey: TREASURY_WALLET,
                            lamports: league.buyIn * 1_000_000_000, // Convert SOL to lamports
                        })
                    );

                    const { blockhash } = await connection.getLatestBlockhash();
                    transaction.recentBlockhash = blockhash;
                    transaction.feePayer = wallet.publicKey;

                    const signature = await wallet.sendTransaction(transaction, connection);
                    await connection.confirmTransaction(signature, 'confirmed');

                    txSignature = signature;
                    console.log("Direct SOL transfer successful:", signature);
                } catch (transferError) {
                    console.error("Direct transfer failed:", transferError);
                    throw new Error("Payment failed. Please try again.");
                }
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

    if (loading) return <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-8 text-center text-white">Loading league details...</div>;
    if (error) return <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-8 text-center text-red-400">{error}</div>;
    if (!league) return <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-8 text-center text-white">League not found</div>;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-8">
            <div className="max-w-md mx-auto bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold mb-2 text-white">{league.name}</h1>
                <p className="text-gray-400 mb-6">Hosted by {league.creator.slice(0, 6)}...{league.creator.slice(-4)}</p>

                <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-gray-700 pb-2 text-white">
                        <span>Buy-in</span>
                        <span className="font-bold">{league.buyIn} {league.currency}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-700 pb-2 text-white">
                        <span>Players</span>
                        <span>{league.currentPlayers} / {league.maxPlayers}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-700 pb-2 text-white">
                        <span>Sessions</span>
                        <span>{league.totalSessions}</span>
                    </div>
                </div>

                {wallet.connected ? (
                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full py-3 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {joining ? 'Processing...' : `Pay ${league.buyIn} ${league.currency} to Join`}
                    </button>
                ) : (
                    <div className="flex flex-col items-center gap-4 p-4 bg-gray-700/50 rounded-md">
                        <p className="text-sm text-gray-400">Please connect your wallet to join.</p>
                        <div className="wallet-adapter-button-trigger">
                            <WalletMultiButton />
                        </div>
                    </div>
                )}

                <div className="mt-4 text-center">
                    <Link href="/" className="text-sm text-gray-400 hover:text-blue-400 hover:underline transition flex items-center justify-center gap-2">
                        🏠 Back to Home
                    </Link>
                </div >
            </div >
        </div >
    );
}
