import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Get all leagues a player has joined
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const playerAddress = searchParams.get('player');

    if (!playerAddress) {
        return NextResponse.json({ error: 'player address required' }, { status: 400 });
    }

    try {
        // Find all PlayerStats for this address to get their leagues
        const playerStats = await prisma.playerStats.findMany({
            where: { address: playerAddress },
            include: {
                league: {
                    include: {
                        _count: { select: { players: true, draftPicks: true } },
                        draftPicks: {
                            where: { player: playerAddress },
                            take: 10,
                            orderBy: { id: 'desc' }
                        }
                    }
                }
            }
        });

        // Format the response
        const leagues = playerStats.map(ps => ({
            ...ps.league,
            playerStats: {
                points: ps.points,
                streak: ps.streak,
                rank: ps.rank
            },
            myPicks: ps.league.draftPicks
        }));

        return NextResponse.json({ leagues });
    } catch (error) {
        console.error('Failed to fetch player leagues:', error);
        return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
    }
}
