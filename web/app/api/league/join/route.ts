import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { leagueId, player, signature } = body;

        if (!leagueId || !player || !signature) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // In a real app, we should verify the transaction signature on-chain
        // to ensure the player actually joined and paid.
        // For now, we assume the client is honest or we verify later via indexer.

        // 1. Find the league (assuming leagueId is the numeric ID from on-chain, stored as string in DB?)
        // The schema says `leagueId String @unique // On-chain PDA address or ID`
        // Let's assume we pass the numeric ID as string.

        const league = await prisma.league.findFirst({
            where: { leagueId: String(leagueId) }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // 2. Create PlayerStats entry
        const playerStats = await prisma.playerStats.create({
            data: {
                leagueId: league.id, // Internal DB ID
                address: player,
                points: 0,
                streak: 0,
            }
        });

        // 3. Update League currentPlayers count
        await prisma.league.update({
            where: { id: league.id },
            data: {
                currentPlayers: { increment: 1 }
            }
        });

        return NextResponse.json({ success: true, playerStats });
    } catch (error) {
        console.error('Error joining league:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
