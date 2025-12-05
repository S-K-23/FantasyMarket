'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { getProgram } from '@/lib/program';

export default function ClaimPayoutButton({ leagueId, isSeasonEnded, hasClaimed }: { leagueId: number, isSeasonEnded: boolean, hasClaimed: boolean }) {
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);
    const [claimed, setClaimed] = useState(hasClaimed);

    const handleClaim = async () => {
        if (!publicKey || !signTransaction || !signAllTransactions) return;
        setLoading(true);

        try {
            const connection = new AnchorProvider(window.solana, window.solana, {}).connection;
            // @ts-ignore
            const program = getProgram(connection, { publicKey, signTransaction, signAllTransactions });

            const [leaguePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("league"), new BN(leagueId).toArrayLike(Buffer, 'le', 8)],
                program.programId
            );

            const [playerStatePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("player_state"), leaguePda.toBuffer(), publicKey.toBuffer()],
                program.programId
            );

            const [prizePoolPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("prize_pool"), leaguePda.toBuffer()],
                program.programId
            );

            await program.methods
                .claimPayout()
                .accounts({
                    league: leaguePda,
                    playerState: playerStatePda,
                    prizePoolVault: prizePoolPda,
                    player: publicKey,
                })
                .rpc();

            setClaimed(true);
            alert("Payout claimed successfully!");

        } catch (error) {
            console.error('Error claiming payout:', error);
            alert('Error claiming payout');
        } finally {
            setLoading(false);
        }
    };

    if (!isSeasonEnded) return null;
    if (claimed) return <button disabled className="px-4 py-2 bg-gray-500 rounded text-white">Payout Claimed</button>;

    return (
        <button
            onClick={handleClaim}
            disabled={loading}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded text-white font-bold"
        >
            {loading ? 'Claiming...' : 'Claim Payout'}
        </button>
    );
}
