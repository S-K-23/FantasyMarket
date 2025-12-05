import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('leagueId');
        const session = searchParams.get('session');

        if (!leagueId) {
            return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
        }

        const league = await prisma.league.findUnique({
            where: { id: parseInt(leagueId) }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        const currentSessionNum = session ? parseInt(session) : league.currentSession;

        const sessionData = await prisma.leagueSession.findUnique({
            where: {
                leagueId_session: {
                    leagueId: parseInt(leagueId),
                    session: currentSessionNum
                }
            }
        });

        // Get pick counts
        const picksCount = await prisma.draftPick.count({
            where: {
                leagueId: parseInt(leagueId),
                session: currentSessionNum
            }
        });

        const totalPicksExpected = league.currentPlayers * league.marketsPerSession;

        return NextResponse.json({
            leagueId: league.id,
            currentSession: league.currentSession,
            requestedSession: currentSessionNum,
            status: sessionData?.status || 'PENDING',
            startTime: sessionData?.startTime,
            endTime: sessionData?.endTime,
            progress: {
                picksMade: picksCount,
                totalExpected: totalPicksExpected,
                percent: totalPicksExpected > 0 ? Math.round((picksCount / totalPicksExpected) * 100) : 0
            }
        });

    } catch (error) {
        console.error('Session status error:', error);
        return NextResponse.json({ error: 'Failed to fetch session status' }, { status: 500 });
    }
}
