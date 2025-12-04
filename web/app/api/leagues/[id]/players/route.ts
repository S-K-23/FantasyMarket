import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const players = await prisma.playerStats.findMany({
            where: { leagueId: parseInt(id) },
            select: {
                id: true,
                address: true,
                points: true,
                streak: true,
                rank: true,
            },
            orderBy: { id: 'asc' }
        });

        return NextResponse.json({ players });
    } catch (error) {
        console.error('Failed to fetch players:', error);
        return NextResponse.json({ players: [] });
    }
}
