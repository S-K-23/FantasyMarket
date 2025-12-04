import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const leagues = await prisma.league.findMany({
            include: {
                _count: {
                    select: { players: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(leagues);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Basic validation could be added here
        const league = await prisma.league.create({
            data: {
                leagueId: body.leagueId,
                name: body.name,
                creator: body.creator,
                buyIn: parseFloat(body.buyIn),
                currency: body.currency,
                maxPlayers: parseInt(body.maxPlayers),
                totalSessions: parseInt(body.totalSessions),
                status: 'SETUP',
            }
        });
        return NextResponse.json(league);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
    }
}
