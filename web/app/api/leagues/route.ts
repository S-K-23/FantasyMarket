import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        // If an ID is provided, return that specific league
        if (id) {
            let league: any = null;

            // Try numeric ID first
            const numericId = parseInt(id);
            if (!isNaN(numericId)) {
                league = await prisma.league.findUnique({
                    where: { id: numericId },
                    include: {
                        players: true,
                        _count: { select: { players: true } }
                    }
                });
            }

            // If not found, try by leagueId string
            if (!league) {
                league = await prisma.league.findUnique({
                    where: { leagueId: id },
                    include: {
                        players: true,
                        _count: { select: { players: true } }
                    }
                });
            }

            if (!league) {
                return NextResponse.json({ error: 'League not found' }, { status: 404 });
            }

            return NextResponse.json(league);
        }

        // No ID provided - return all leagues
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
