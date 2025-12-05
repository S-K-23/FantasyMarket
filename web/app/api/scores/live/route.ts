import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateLiveScore } from '@/lib/scoring';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get('league_id');
    const sessionIndex = searchParams.get('session');

    if (!leagueId) {
        return NextResponse.json({ error: 'league_id required' }, { status: 400 });
    }

    try {
        // Get league info
        const league = await prisma.league.findFirst({
            where: { OR: [{ id: parseInt(leagueId) }, { leagueId }] }
        });

        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Get all draft picks (unresolved = open markets)
        let picks = await prisma.draftPick.findMany({
            where: {
                leagueId: league.id,
                isResolved: false, // Only open markets for live scoring
                ...(sessionIndex && { session: parseInt(sessionIndex) })
            },
            include: {
                market: {
                    select: {
                        id: true,
                        title: true,
                        currentPriceYes: true,
                        currentPriceNo: true
                    }
                }
            }
        });

        // Group by player and calculate live scores
        const playerScores = new Map<string, {
            player_address: string;
            live_score: number;
            final_score: number;
            open_picks: any[];
            wins: number;
            losses: number;
            pending: number;
        }>();

        // Calculate live scores for open picks
        for (const pick of picks) {
            if (!pick.market?.currentPriceYes) continue;

            const p0 = (pick.snapshotOdds || 0) / 10000; // Convert from basis points
            const pt = pick.market.currentPriceYes;

            const livePoints = calculateLiveScore(
                pick.prediction as 'YES' | 'NO',
                p0,
                pt
            );

            if (!playerScores.has(pick.player)) {
                playerScores.set(pick.player, {
                    player_address: pick.player,
                    live_score: 0,
                    final_score: 0,
                    open_picks: [],
                    wins: 0,
                    losses: 0,
                    pending: 0
                });
            }

            const playerData = playerScores.get(pick.player)!;
            playerData.live_score += livePoints;
            playerData.pending += 1;
            playerData.open_picks.push({
                market_id: pick.marketId,
                market_title: pick.market.title,
                prediction: pick.prediction,
                p0,
                p_current: pt,
                live_points: livePoints
            });
        }

        // Get player stats for final scores and wins/losses
        const players = await prisma.playerStats.findMany({
            where: { leagueId: league.id }
        });

        for (const player of players) {
            if (!playerScores.has(player.address)) {
                playerScores.set(player.address, {
                    player_address: player.address,
                    live_score: 0,
                    final_score: 0,
                    open_picks: [],
                    wins: 0,
                    losses: 0,
                    pending: 0
                });
            }

            const playerData = playerScores.get(player.address)!;
            playerData.final_score = player.points;

            // Get win/loss record
            const resolved = await prisma.draftPick.findMany({
                where: {
                    leagueId: league.id,
                    player: player.address,
                    isResolved: true
                }
            });

            playerData.wins = resolved.filter(p => (p.points || 0) > 0).length;
            playerData.losses = resolved.filter(p => (p.points || 0) < 0).length;
        }

        // Convert to array and calculate totals
        const leaderboard = Array.from(playerScores.values()).map(p => ({
            ...p,
            total_score: p.live_score + p.final_score
        }));

        // Sort by total score (highest first)
        leaderboard.sort((a, b) => b.total_score - a.total_score);

        // Add ranks and prize shares
        const totalScore = leaderboard.reduce((sum, p) => sum + Math.max(0, p.total_score), 0);

        const result = leaderboard.map((p, index) => ({
            rank: index + 1,
            player_address: p.player_address,
            live_score: Math.round(p.live_score * 10) / 10,
            final_score: p.final_score,
            total_score: Math.round(p.total_score * 10) / 10,
            streak: 0, // TODO: Calculate from resolved picks
            prize_share: totalScore > 0 ? Math.max(0, p.total_score) / totalScore : 0,
            change_24h: 0, // TODO: Track historical ranks
            wins: p.wins,
            losses: p.losses,
            pending: p.pending
        }));

        return NextResponse.json({
            league_id: league.id,
            session_index: sessionIndex ? parseInt(sessionIndex) : null,
            updated_at: new Date().toISOString(),
            players: result
        });

    } catch (error) {
        console.error('Live scores error:', error);
        return NextResponse.json({
            error: 'Failed to calculate live scores',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
