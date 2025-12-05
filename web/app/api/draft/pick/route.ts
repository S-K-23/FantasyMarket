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

        // 1. Find the league and its players
        const league = await prisma.league.findFirst({
            where: { leagueId: String(leagueId) },
            include: { players: true }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // 2. Validate Draft Order & Pick Limits
        // Fetch all existing picks for this league to determine the current state
        const existingPicks = await prisma.draftPick.findMany({
            where: { leagueId: league.id },
            orderBy: { pickIndex: 'asc' }
        });

        const currentPickCount = existingPicks.length;

        // Validate pickIndex matches server state
        if (pickIndex !== undefined && pickIndex !== currentPickCount) {
            return NextResponse.json({
                error: `Sync error: Client thinks it's pick ${pickIndex}, but server is at ${currentPickCount}`
            }, { status: 409 });
        }

        // Calculate who should be drafting now
        const draftOrder = league.players.map(p => p.address); // Assuming players are returned in order, or we need a specific sort? 
        // Ideally players should be sorted by ID or a specific 'draftOrder' field if it existed. 
        // For now, let's assume the order in DB is the order (or sort by ID to be deterministic).
        draftOrder.sort(); // Simple deterministic sort for now, or match frontend logic if it uses a specific sort.
        // Frontend uses: const order = playersData.players?.map((p: Player) => p.address) || [];
        // And backend usually returns them in insertion order or ID order. Let's sort by ID to be safe if we can, but here we only have address in the map.
        // Let's re-map from sorted players.
        const sortedPlayers = [...league.players].sort((a, b) => a.id - b.id);
        const deterministicDraftOrder = sortedPlayers.map(p => p.address);

        if (deterministicDraftOrder.length === 0) {
            return NextResponse.json({ error: 'No players in league' }, { status: 400 });
        }

        // Calculate expected drafter (Snake Draft)
        const round = Math.floor(currentPickCount / deterministicDraftOrder.length);
        const positionInRound = currentPickCount % deterministicDraftOrder.length;

        const expectedPlayerIndex = round % 2 === 0
            ? positionInRound
            : deterministicDraftOrder.length - 1 - positionInRound;

        const expectedDrafter = deterministicDraftOrder[expectedPlayerIndex];

        // Strict Order Check
        if (player !== expectedDrafter) {
            return NextResponse.json({
                error: `Not your turn! Waiting for ${expectedDrafter.slice(0, 6)}...`
            }, { status: 403 });
        }

        // Pick Limit Check
        const playerPicks = existingPicks.filter(p => p.player === player);
        const maxPicks = league.marketsPerSession || 5;

        if (playerPicks.length >= maxPicks) {
            return NextResponse.json({ error: 'You have reached the maximum number of picks' }, { status: 403 });
        }

        // 3. Find or Create Market with real Polymarket data
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

        // 4. Create DraftPick with snapshot odds
        const pick = await prisma.draftPick.create({
            data: {
                leagueId: league.id,
                marketId: market.id,
                player: player,
                prediction: prediction, // YES or NO
                session: session || 1,
                pickIndex: currentPickCount, // Enforce server-side index
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
