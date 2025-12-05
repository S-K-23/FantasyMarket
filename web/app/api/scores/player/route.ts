import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateLiveScore, calculateFinalPoints, calculateDraftTimeProb } from '@/lib/scoring';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get('league_id');
    const playerAddress = searchParams.get('player_address');

    if (!leagueId || !playerAddress) {
        return NextResponse.json({
            error: 'league_id and player_address required'
        }, { status: 400 });
    }

    try {
        // Get league
        const league = await prisma.league.findFirst({
            where: { OR: [{ id: parseInt(leagueId) }, { leagueId }] }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Get player stats
        const playerStats = await prisma.playerStats.findFirst({
            where: {
                leagueId: league.id,
                address: playerAddress
            }
        });

        // Get all player's picks
        const allPicks = await prisma.draftPick.findMany({
            where: {
                leagueId: league.id,
                player: playerAddress
            },
            include: {
                market: true
            },
            orderBy: {
                pickIndex: 'asc'
            }
        });

        // Calculate overall scores
        let livePoints = 0;
        let finalPoints = playerStats?.points || 0;

        const pickDetails = allPicks.map(pick => {
            const p0 = (pick.snapshotOdds || 0) / 10000;
            const currentPrice = pick.market?.currentPriceYes || p0;

            let points = 0;
            let status: 'open' | 'resolved' = 'open';

            if (pick.isResolved) {
                points = pick.points || 0;
                status = 'resolved';
            } else if (pick.market?.currentPriceYes) {
                points = calculateLiveScore(
                    pick.prediction as 'YES' | 'NO',
                    p0,
                    currentPrice
                );
                livePoints += points;
            }

            return {
                session_index: pick.session,
                market_id: pick.marketId,
                market_title: pick.market?.title || 'Unknown Market',
                prediction: pick.prediction,
                snapshot_odds: p0,
                current_odds: currentPrice,
                status,
                resolution: pick.market?.resolution || null,
                points: Math.round(points * 10) / 10,
                drafted_at: new Date().toISOString() // TODO: Add to schema
            };
        });

        // Group by session
        const bySession = new Map<number, typeof pickDetails>();
        for (const pick of pickDetails) {
            if (!bySession.has(pick.session_index)) {
                bySession.set(pick.session_index, []);
            }
            bySession.get(pick.session_index)!.push(pick);
        }

        const sessionStats = Array.from(bySession.entries()).map(([sessionIndex, picks]) => {
            const resolved = picks.filter(p => p.status === 'resolved');
            const correct = resolved.filter(p => p.points > 0);
            const totalPoints = picks.reduce((sum, p) => sum + p.points, 0);

            return {
                session_index: sessionIndex,
                points: Math.round(totalPoints * 10) / 10,
                picks_correct: correct.length,
                picks_total: picks.length,
                had_clean_sweep: picks.length >= 5 && resolved.length === picks.length && correct.length === picks.length,
                session_rank: 0 // TODO: Calculate against other players
            };
        });

        return NextResponse.json({
            player_address: playerAddress,
            league_id: league.id,
            overall: {
                total_points: Math.round((livePoints + finalPoints) * 10) / 10,
                final_points: finalPoints,
                live_points: Math.round(livePoints * 10) / 10,
                rank: 0, // TODO: Get from leaderboard
                streak: playerStats?.streak || 0,
                prize_share: 0 // TODO: Calculate
            },
            by_session: sessionStats,
            bonuses: {
                streak_bonus: 0, // TODO: Calculate from streak
                longshot_bonus: 0, // TODO: Count from picks
                clean_sweep_bonus: sessionStats.filter(s => s.had_clean_sweep).length * 50,
                total: 0
            },
            all_picks: pickDetails
        });

    } catch (error) {
        console.error('Player score error:', error);
        return NextResponse.json({
            error: 'Failed to get player scores',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
