import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Start the draft for a league
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { leagueId, creator } = body;

        if (!leagueId) {
            return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
        }

        // Find the league
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

        // Verify creator
        if (creator && league.creator !== creator) {
            return NextResponse.json({ error: 'Only the league creator can start the draft' }, { status: 403 });
        }

        // Check minimum players
        if (league.players.length < 2) {
            return NextResponse.json({ error: 'Need at least 2 players to start draft' }, { status: 400 });
        }

        // Check league status
        if (league.status !== 'SETUP') {
            return NextResponse.json({ error: `Draft already started (status: ${league.status})` }, { status: 400 });
        }

        // Generate draft order (shuffle players)
        const playerAddresses = league.players.map(p => p.address);
        const shuffled = [...playerAddresses].sort(() => Math.random() - 0.5);

        // Update league
        const updatedLeague = await prisma.league.update({
            where: { id: league.id },
            data: {
                status: 'DRAFTING',
                draftOrder: shuffled,
            }
        });

        return NextResponse.json({
            success: true,
            league: updatedLeague,
            draftOrder: shuffled
        });
    } catch (error) {
        console.error('Start draft error:', error);
        return NextResponse.json({ error: 'Failed to start draft' }, { status: 500 });
    }
}
