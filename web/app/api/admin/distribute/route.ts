import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { distributePayout } from '@/lib/program';
import { NodeWallet } from '@/lib/wallet';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { leagueId } = body;

        if (!leagueId) {
            return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
        }

        // 1. Fetch league and players
        const league = await prisma.league.findFirst({
            where: {
                OR: [
                    { leagueId: String(leagueId) },
                    { id: typeof leagueId === 'number' ? leagueId : parseInt(leagueId) || 0 }
                ]
            },
            include: { players: true }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // 2. Calculate Payouts
        // Total prize pool = buyIn * players
        const totalPrizePool = league.buyIn * league.players.length;
        const totalPoints = league.players.reduce((sum, p) => sum + p.points, 0);

        if (totalPoints === 0) {
            return NextResponse.json({ error: 'No points scored yet, cannot distribute' }, { status: 400 });
        }

        const results: any[] = [];

        // 3. Distribute to each player
        for (const player of league.players) {
            const share = player.points / totalPoints;
            const payoutAmount = totalPrizePool * share;

            if (payoutAmount > 0) {
                try {
                    // Try on-chain distribution
                    let tx = 'db-only-' + Date.now();

                    if (process.env.KEEPER_KEY) {
                        try {
                            const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com");
                            const treasuryKey = Keypair.fromSecretKey(
                                new Uint8Array(JSON.parse(process.env.KEEPER_KEY))
                            );
                            const treasuryWallet = new NodeWallet(treasuryKey);

                            // Note: league.leagueId in DB is string, on-chain expects number
                            const numericLeagueId = parseInt(league.leagueId.replace('league_', ''));

                            tx = await distributePayout(
                                connection,
                                treasuryWallet,
                                numericLeagueId,
                                new PublicKey(player.address)
                            );
                        } catch (chainError) {
                            console.warn(`On-chain payout failed for ${player.address}, falling back to DB record`, chainError);
                        }
                    }

                    results.push({
                        player: player.address,
                        points: player.points,
                        share: share.toFixed(4),
                        amount: payoutAmount.toFixed(4),
                        tx
                    });

                } catch (e) {
                    console.error(`Failed to process payout for ${player.address}`, e);
                    results.push({ player: player.address, status: 'Failed', error: String(e) });
                }
            }
        }

        // 4. Mark league as completed
        await prisma.league.update({
            where: { id: league.id },
            data: { status: 'COMPLETED' }
        });

        return NextResponse.json({
            success: true,
            totalPrizePool,
            totalPoints,
            payouts: results
        });

    } catch (error) {
        console.error('Payout Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
