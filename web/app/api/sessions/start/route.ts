import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { leagueId, session } = body;

        if (!leagueId || !session) {
            return NextResponse.json({ error: 'leagueId and session required' }, { status: 400 });
        }

        // Check if session already exists
        const existingSession = await prisma.leagueSession.findUnique({
            where: {
                leagueId_session: {
                    leagueId: parseInt(leagueId),
                    session: parseInt(session)
                }
            }
        });

        if (existingSession) {
            return NextResponse.json({ error: 'Session already started' }, { status: 400 });
        }

        // Create session
        const newSession = await prisma.leagueSession.create({
            data: {
                leagueId: parseInt(leagueId),
                session: parseInt(session),
                status: 'DRAFTING',
                startTime: new Date(),
                // Set deadline to 48 hours from now
                endTime: new Date(Date.now() + 48 * 60 * 60 * 1000)
            }
        });

        // Update league status
        await prisma.league.update({
            where: { id: parseInt(leagueId) },
            data: {
                status: 'DRAFTING',
                currentSession: parseInt(session)
            }
        });

        return NextResponse.json(newSession);

    } catch (error) {
        console.error('Start session error:', error);
        return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
    }
}
