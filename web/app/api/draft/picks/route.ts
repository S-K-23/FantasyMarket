import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const session = searchParams.get('session');

    if (!leagueId) {
        return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
    }

    try {
        const where: any = { leagueId: parseInt(leagueId) };
        if (session) {
            where.session = parseInt(session);
        }

        const picks = await prisma.draftPick.findMany({
            where,
            orderBy: { pickIndex: 'asc' }
        });

        return NextResponse.json({ picks });
    } catch (error) {
        console.error('Failed to fetch picks:', error);
        return NextResponse.json({ picks: [] });
    }
}
