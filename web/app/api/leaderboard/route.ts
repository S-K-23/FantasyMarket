import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch global ELO leaderboard
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        const leaderboard = await prisma.userProfile.findMany({
            orderBy: { elo: 'desc' },
            take: limit
        });

        // Add rank to each entry
        const rankedLeaderboard = leaderboard.map((user, index) => ({
            ...user,
            rank: index + 1
        }));

        return NextResponse.json(rankedLeaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
