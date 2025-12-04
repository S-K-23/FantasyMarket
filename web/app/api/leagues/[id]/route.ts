import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Try to find by numeric ID first, then by leagueId string
        let league: any = null;

        // Check if it's a numeric ID
        const numericId = parseInt(id);
        if (!isNaN(numericId)) {
            league = await prisma.league.findUnique({
                where: { id: numericId },
                include: {
                    players: true,
                    draftPicks: true,
                }
            });
        }

        // If not found by numeric ID, try by leagueId string
        if (!league) {
            league = await prisma.league.findUnique({
                where: { leagueId: id },
                include: {
                    players: true,
                    draftPicks: true,
                }
            });
        }

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        return NextResponse.json(league);
    } catch (error) {
        console.error('Error fetching league:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
