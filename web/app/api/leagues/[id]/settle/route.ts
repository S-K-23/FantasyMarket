import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Settle a 1v1 league - determine winner and update ELO
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Find league
        const league = await prisma.league.findFirst({
            where: {
                OR: [
                    { id: parseInt(id) || 0 },
                    { leagueId: id }
                ]
            },
            include: {
                players: true,
                draftPicks: {
                    include: { market: true }
                }
            }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        if (league.leagueType !== 'ONE_ON_ONE') {
            return NextResponse.json({ error: 'Not a 1v1 league' }, { status: 400 });
        }

        if (league.players.length !== 2) {
            return NextResponse.json({ error: 'Need exactly 2 players' }, { status: 400 });
        }

        // Calculate P&L for each player based on their picks
        const playerPnL: Record<string, number> = {};

        for (const player of league.players) {
            let pnl = 0;
            const picks = league.draftPicks.filter(p => p.player === player.address);

            for (const pick of picks) {
                const entryPrice = (pick.snapshotOdds || 5000) / 10000; // Convert basis points to decimal
                const currentPrice = pick.prediction === 'YES'
                    ? (pick.market.currentPriceYes || 0.5)
                    : (pick.market.currentPriceNo || 0.5);

                // Simulated position: $100 per pick
                const positionSize = 100;
                const shares = positionSize / entryPrice;
                const currentValue = shares * currentPrice;
                pnl += currentValue - positionSize;
            }

            playerPnL[player.address] = pnl;
        }

        // Determine winner
        const [player1, player2] = league.players;
        const pnl1 = playerPnL[player1.address] || 0;
        const pnl2 = playerPnL[player2.address] || 0;

        let winner: string;
        let loser: string;

        if (pnl1 > pnl2) {
            winner = player1.address;
            loser = player2.address;
        } else if (pnl2 > pnl1) {
            winner = player2.address;
            loser = player1.address;
        } else {
            // Tie - no ELO change
            await prisma.league.update({
                where: { id: league.id },
                data: { status: 'COMPLETED' }
            });

            return NextResponse.json({
                result: 'TIE',
                pnl: playerPnL,
                message: 'Match ended in a tie. No ELO changes.'
            });
        }

        // Update ELO scores
        const ELO_CHANGE = 100;

        await prisma.userProfile.upsert({
            where: { address: winner },
            update: {
                elo: { increment: ELO_CHANGE },
                wins: { increment: 1 }
            },
            create: {
                address: winner,
                elo: 1000 + ELO_CHANGE,
                wins: 1
            }
        });

        await prisma.userProfile.upsert({
            where: { address: loser },
            update: {
                elo: { decrement: ELO_CHANGE },
                losses: { increment: 1 }
            },
            create: {
                address: loser,
                elo: 1000 - ELO_CHANGE,
                losses: 1
            }
        });

        // Mark league as completed
        await prisma.league.update({
            where: { id: league.id },
            data: { status: 'COMPLETED' }
        });

        // Fetch updated profiles
        const winnerProfile = await prisma.userProfile.findUnique({ where: { address: winner } });
        const loserProfile = await prisma.userProfile.findUnique({ where: { address: loser } });

        return NextResponse.json({
            result: 'SETTLED',
            winner: {
                address: winner,
                pnl: playerPnL[winner],
                newElo: winnerProfile?.elo,
                eloChange: `+${ELO_CHANGE}`
            },
            loser: {
                address: loser,
                pnl: playerPnL[loser],
                newElo: loserProfile?.elo,
                eloChange: `-${ELO_CHANGE}`
            }
        });

    } catch (error) {
        console.error('Error settling league:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
