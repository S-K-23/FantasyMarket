import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateFinalPoints, calculateDraftTimeProb, checkLongshotBonus } from '@/lib/scoring';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { market_id, resolution } = body;

    if (!market_id || !resolution) {
        return NextResponse.json({
            error: 'market_id and resolution required'
        }, { status: 400 });
    }

    if (!['YES', 'NO', 'INVALID'].includes(resolution)) {
        return NextResponse.json({
            error: 'resolution must be YES, NO, or INVALID'
        }, { status: 400 });
    }

    try {
        // Update market
        await prisma.market.update({
            where: { id: market_id },
            data: {
                resolution,
                resolvedAt: new Date()
            }
        });

        // Get all picks for this market
        const picks = await prisma.draftPick.findMany({
            where: {
                marketId: market_id,
                isResolved: false
            }
        });

        let updatedCount = 0;
        const playerUpdates = new Map<string, { leagueId: number; pointsDelta: number }>();

        // Calculate final points for each pick
        for (const pick of picks) {
            let finalPoints = 0;

            if (resolution !== 'INVALID') {
                const p0 = (pick.snapshotOdds || 0) / 10000;
                const pPred = calculateDraftTimeProb(
                    pick.prediction as 'YES' | 'NO',
                    p0
                );
                const correct = pick.prediction === resolution;

                // Base points
                finalPoints = calculateFinalPoints(correct, pPred);

                // Long-shot bonus
                const longshotBonus = checkLongshotBonus(correct, pPred);
                finalPoints += longshotBonus;
            }

            // Update pick
            await prisma.draftPick.update({
                where: { id: pick.id },
                data: {
                    isResolved: true,
                    points: finalPoints
                }
            });

            // Track player point changes
            const key = `${pick.leagueId}-${pick.player}`;
            if (!playerUpdates.has(key)) {
                playerUpdates.set(key, {
                    leagueId: pick.leagueId,
                    pointsDelta: 0
                });
            }
            playerUpdates.get(key)!.pointsDelta += finalPoints;

            updatedCount++;
        }

        // Update player totals
        for (const [key, update] of playerUpdates.entries()) {
            const [leagueId, playerAddress] = key.split('-');

            // Get current points
            const player = await prisma.playerStats.findFirst({
                where: {
                    leagueId: parseInt(leagueId),
                    address: playerAddress
                }
            });

            if (player) {
                await prisma.playerStats.update({
                    where: { id: player.id },
                    data: {
                        points: player.points + update.pointsDelta
                    }
                });
            }
        }

        // TODO: Calculate and update streaks
        // TODO: Check for clean sweep bonuses
        // TODO: Create resolution event for activity feed

        return NextResponse.json({
            success: true,
            market_id,
            resolution,
            picks_updated: updatedCount,
            players_affected: playerUpdates.size
        });

    } catch (error) {
        console.error('Market resolution error:', error);
        return NextResponse.json({
            error: 'Failed to resolve market',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
