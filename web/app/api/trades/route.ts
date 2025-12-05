import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { leagueId, proposer, receiver, proposerPick, receiverPick, tradeId, expiresAt } = body;

        if (!leagueId || !proposer || !receiver || !proposerPick || !receiverPick || !tradeId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const trade = await prisma.trade.create({
            data: {
                tradeId: tradeId.toString(),
                leagueId: Number(leagueId),
                proposer,
                receiver,
                proposerPick: Number(proposerPick),
                receiverPick: Number(receiverPick),
                status: 'PENDING',
                expiresAt: new Date(expiresAt * 1000),
            },
        });

        return NextResponse.json({ trade });
    } catch (error) {
        console.error('Error creating trade:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    const leagueId = searchParams.get('leagueId');

    try {
        let trades;
        if (playerId) {
            trades = await prisma.trade.findMany({
                where: {
                    OR: [
                        { proposer: playerId },
                        { receiver: playerId },
                    ],
                },
                include: {
                    league: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        } else if (leagueId) {
            trades = await prisma.trade.findMany({
                where: {
                    leagueId: Number(leagueId),
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        } else {
            return NextResponse.json({ error: 'Missing playerId or leagueId' }, { status: 400 });
        }

        // Manually fetch pick details since we don't have relations set up yet
        const tradesWithPicks = await Promise.all(trades.map(async (trade) => {
            const proposerPickData = await prisma.draftPick.findUnique({ where: { id: trade.proposerPick } });
            const receiverPickData = await prisma.draftPick.findUnique({ where: { id: trade.receiverPick } });
            return {
                ...trade,
                proposerPickData,
                receiverPickData,
            };
        }));

        return NextResponse.json({ trades: tradesWithPicks });
    } catch (error) {
        console.error('Error fetching trades:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
