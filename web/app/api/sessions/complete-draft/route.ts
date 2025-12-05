import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { leagueId, session } = body;

        if (!leagueId || !session) {
            return NextResponse.json({ error: 'leagueId and session required' }, { status: 400 });
        }

        // Verify all players have drafted?
        // For MVP, we might just force complete or check if picks count matches
        // Let's just update status for now

        // Update session status
        await prisma.leagueSession.update({
            where: {
                leagueId_session: {
                    leagueId: parseInt(leagueId),
                    session: parseInt(session)
                }
            },
            data: {
                status: 'ACTIVE'
            }
        });

        // Update league status
        await prisma.league.update({
            where: { id: parseInt(leagueId) },
            data: {
                status: 'ACTIVE'
            }
        });

        return NextResponse.json({ success: true, message: 'Draft completed, session active' });

    } catch (error) {
        console.error('Complete draft error:', error);
        return NextResponse.json({ error: 'Failed to complete draft' }, { status: 500 });
    }
}
