import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { leagueId, marketId, player, prediction, session, pickIndex, snapshotOdds } = body;

        if (!leagueId || !marketId || !player || !prediction) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Find the league
        const league = await prisma.league.findFirst({
            where: { leagueId: String(leagueId) }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // 2. Find or Create Market (if not exists)
        // We might need to fetch market details from Polymarket if not in DB
        let market = await prisma.market.findUnique({
            where: { id: marketId }
        });

        if (!market) {
            // Ideally fetch from Polymarket API here to get title/category/etc.
            // For now, create a placeholder or require frontend to pass details?
            // Let's assume frontend passes minimal details or we fetch.
            // To keep it simple, we'll create with placeholder if missing, 
            // but really we should have the market synced.

            // Let's try to fetch from our own lib if possible, or just fail?
            // Better: upsert if we trust the input, or just create with ID.
            market = await prisma.market.create({
                data: {
                    id: marketId,
                    title: `Market ${marketId}`, // Placeholder
                    category: 'Unknown',
                    p0: snapshotOdds ? snapshotOdds / 10000 : 0.5,
                }
            });
        }

        // 3. Create DraftPick
        const pick = await prisma.draftPick.create({
            data: {
                leagueId: league.id,
                marketId: market.id,
                player: player,
                prediction: prediction, // YES or NO
                session: session || 1,
                pickIndex: pickIndex || 0,
                isResolved: false,
            }
        });

        return NextResponse.json({ success: true, pick });
    } catch (error) {
        console.error('Error recording pick:', error);
        // Handle unique constraint violation (already picked)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
