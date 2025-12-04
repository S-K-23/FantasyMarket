import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            leagueId,
            marketId,
            marketTitle,
            marketCategory,
            marketEndDate,
            player,
            prediction,
            session,
            pickIndex,
            snapshotOdds,
            currentPriceYes,
            currentPriceNo
        } = body;

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

        // 2. Find or Create Market with real Polymarket data
        let market = await prisma.market.findUnique({
            where: { id: marketId }
        });

        if (!market) {
            // Create market with real Polymarket data passed from frontend
            const endDate = marketEndDate ? new Date(marketEndDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            market = await prisma.market.create({
                data: {
                    id: marketId,
                    title: marketTitle || `Market ${marketId}`,
                    category: marketCategory || 'Unknown',
                    p0: snapshotOdds ? snapshotOdds / 10000 : 0.5,
                    endDate: endDate,
                    currentPriceYes: currentPriceYes || null,
                    currentPriceNo: currentPriceNo || null,
                    active: true,
                }
            });
        } else {
            // Update market with latest prices
            await prisma.market.update({
                where: { id: marketId },
                data: {
                    currentPriceYes: currentPriceYes || market.currentPriceYes,
                    currentPriceNo: currentPriceNo || market.currentPriceNo,
                }
            });
        }

        // 3. Create DraftPick with snapshot odds
        const pick = await prisma.draftPick.create({
            data: {
                leagueId: league.id,
                marketId: market.id,
                player: player,
                prediction: prediction, // YES or NO
                session: session || 1,
                pickIndex: pickIndex || 0,
                snapshotOdds: snapshotOdds || null, // Stored in basis points (e.g., 6500 = 65%)
                isResolved: false,
            }
        });

        return NextResponse.json({
            success: true,
            pick: {
                ...pick,
                marketTitle: market.title,
            }
        });
    } catch (error: unknown) {
        console.error('Error recording pick:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Handle unique constraint violation (already picked)
        if (errorMessage.includes('Unique constraint')) {
            return NextResponse.json({ error: 'This market/prediction is already drafted' }, { status: 409 });
        }

        return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
    }
}
