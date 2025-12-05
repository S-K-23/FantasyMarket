'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { getProgram } from '@/lib/program';

interface Trade {
    id: string;
    tradeId: string;
    proposer: string;
    receiver: string;
    proposerPick: number;
    receiverPick: number;
    status: string;
    expiresAt: string;
    leagueId: number; // Added leagueId
    league: {
        name: string;
    };
    // Added pick details from API
    proposerPickData?: {
        marketId: string;
        prediction: string;
        session: number;
    };
    receiverPickData?: {
        marketId: string;
        prediction: string;
        session: number;
    };
}

export default function TradeInterface({ leagueId }: { leagueId: number }) {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (publicKey) {
            fetchTrades();
        }
    }, [publicKey, leagueId]);

    const fetchTrades = async () => {
        if (!publicKey) return;
        try {
            const res = await fetch(`/api/trades?playerId=${publicKey.toString()}&leagueId=${leagueId}`);
            const data = await res.json();
            if (data.trades) {
                setTrades(data.trades);
            }
        } catch (error) {
            console.error('Error fetching trades:', error);
        }
    };

    const handleRespond = async (trade: Trade, accept: boolean) => {
        if (!publicKey || !signTransaction || !signAllTransactions) return;
        setLoading(true);

        try {
            const connection = new AnchorProvider(window.solana, window.solana, {}).connection;
            // @ts-ignore
            const provider = new AnchorProvider(connection, { publicKey, signTransaction, signAllTransactions }, {});
            const program = getProgram(connection, { publicKey, signTransaction, signAllTransactions });

            const [tradeProposalPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("trade"), new BN(trade.leagueId).toArrayLike(Buffer, 'le', 8), new BN(trade.tradeId).toArrayLike(Buffer, 'le', 8)],
                program.programId
            );

            if (!trade.proposerPickData || !trade.receiverPickData) {
                alert("Missing pick data for trade");
                return;
            }

            // Derive Proposer Pick PDA
            const [proposerPickPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("draft_pick"),
                    new BN(trade.leagueId).toArrayLike(Buffer, 'le', 8),
                    Buffer.from([trade.proposerPickData.session]),
                    Buffer.from(trade.proposerPickData.marketId),
                    Buffer.from([trade.proposerPickData.prediction === 'YES' ? 1 : 0])
                ],
                program.programId
            );

            // Derive Receiver Pick PDA
            const [receiverPickPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("draft_pick"),
                    new BN(trade.leagueId).toArrayLike(Buffer, 'le', 8),
                    Buffer.from([trade.receiverPickData.session]),
                    Buffer.from(trade.receiverPickData.marketId),
                    Buffer.from([trade.receiverPickData.prediction === 'YES' ? 1 : 0])
                ],
                program.programId
            );

            await program.methods
                .respondToTrade(accept)
                .accounts({
                    tradeProposal: tradeProposalPda,
                    respondent: publicKey,
                    proposerPick: proposerPickPda,
                    receiverPick: receiverPickPda,
                })
                .rpc();

            alert(`Trade ${accept ? 'accepted' : 'rejected'}!`);
            fetchTrades();

        } catch (error) {
            console.error('Error responding to trade:', error);
            alert('Error responding to trade');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg bg-gray-800 text-white">
            <h2 className="text-xl font-bold mb-4">Trade Proposals</h2>
            {trades.length === 0 ? (
                <p>No active trades.</p>
            ) : (
                <div className="space-y-4">
                    {trades.map((trade) => (
                        <div key={trade.id} className="p-3 border border-gray-700 rounded flex justify-between items-center">
                            <div>
                                <p className="font-semibold">Trade #{trade.tradeId}</p>
                                <p className="text-sm text-gray-400">From: {trade.proposer.slice(0, 4)}...{trade.proposer.slice(-4)}</p>
                                <p className="text-sm text-gray-400">Status: {trade.status}</p>
                            </div>
                            {trade.status === 'PENDING' && trade.receiver === publicKey?.toString() && (
                                <div className="space-x-2">
                                    <button
                                        onClick={() => handleRespond(trade, true)}
                                        disabled={loading}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleRespond(trade, false)}
                                        disabled={loading}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

