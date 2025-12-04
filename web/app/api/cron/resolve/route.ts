import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMarket } from '@/lib/polymarket';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { NodeWallet } from '@/lib/wallet';

// Updated IDL to match lib.rs
const IDL: any = {
    "version": "0.1.0",
    "name": "anchor",
    "instructions": [
        {
            "name": "resolveMarket",
            "accounts": [
                { "name": "league", "writable": true, "signer": false },
                { "name": "draftPick", "writable": true, "signer": false },
                { "name": "playerState", "writable": true, "signer": false },
                { "name": "signer", "writable": true, "signer": true }
            ],
            "args": [
                { "name": "marketId", "type": "string" },
                { "name": "outcome", "type": "bool" },
                { "name": "finalProb", "type": "u32" }
            ]
        }
    ],
    "metadata": {
        "address": "HtJHB7t3esZkEdZhvUHQNYj4RYXrQsGxqzRoyMzmsBJQ"
    }
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { marketId, forceOutcome } = body; // forceOutcome: 'YES' | 'NO'

        // 1. Fetch unresolved picks for this market (or all if no marketId)
        const whereClause: any = { isResolved: false };
        if (marketId) whereClause.marketId = marketId;

        const unresolvedPicks = await prisma.draftPick.findMany({
            where: whereClause,
            include: { league: true }
        });

        if (unresolvedPicks.length === 0) {
            return NextResponse.json({ message: 'No unresolved picks found' });
        }

        const results: any[] = [];

        // Group by market to avoid redundant API calls
        const picksByMarket = unresolvedPicks.reduce((acc: any, pick: any) => {
            if (!acc[pick.marketId]) acc[pick.marketId] = [];
            acc[pick.marketId].push(pick);
            return acc;
        }, {});

        for (const [mId, picks] of Object.entries(picksByMarket) as [string, any[]][]) {
            let outcome: boolean | null = null;
            let finalProb = 0;

            // A. Manual/Forced Resolution
            if (marketId && mId === marketId && forceOutcome) {
                outcome = forceOutcome === 'YES';
                finalProb = outcome ? 10000 : 0;
            }
            // B. Polymarket API Check
            else {
                const market = await getMarket(mId);
                if (market && market.closed && market.active === false) {
                    const winningToken = market.tokens.find(t => t.winner);
                    if (winningToken) {
                        outcome = winningToken.outcome === 'Yes';
                        finalProb = outcome ? 10000 : 0;
                    }
                }
            }

            if (outcome !== null) {
                // Calculate points for each pick
                for (const pick of picks) {
                    try {
                        // Calculate points
                        // Base points = 100 * (1 - p_pred)
                        // p_pred is snapshotOdds (basis points) / 10000
                        // If prediction matches outcome, they get points. Else 0.

                        const predictionMatches = (pick.prediction === 'YES' && outcome) ||
                            (pick.prediction === 'NO' && !outcome);

                        let pointsEarned = 0;
                        if (predictionMatches) {
                            const pPred = pick.prediction === 'YES'
                                ? (pick.snapshotOdds || 5000) / 10000
                                : 1 - ((pick.snapshotOdds || 5000) / 10000);

                            const base = 100 * (1 - pPred);
                            const multiplier = pPred >= 0.70 ? 1.0 : pPred >= 0.40 ? 1.2 : 1.5;
                            pointsEarned = Math.round(base * multiplier);
                        }

                        // Try on-chain resolution (optional)
                        let onChainSuccess = false;
                        if (process.env.KEEPER_KEY) {
                            try {
                                // ... (Existing on-chain logic would go here, simplified for brevity)
                                // const connection = ...
                                // await program.methods.resolveMarket(...)
                                // onChainSuccess = true;
                            } catch (e) {
                                console.warn(`On-chain resolution failed for pick ${pick.id}, falling back to DB`, e);
                            }
                        }

                        // Update DB
                        await prisma.$transaction([
                            // 1. Update DraftPick
                            prisma.draftPick.update({
                                where: { id: pick.id },
                                data: {
                                    isResolved: true,
                                    points: pointsEarned
                                }
                            }),
                            // 2. Update PlayerStats
                            prisma.playerStats.update({
                                where: {
                                    leagueId_address: {
                                        leagueId: pick.leagueId,
                                        address: pick.player
                                    }
                                },
                                data: {
                                    points: { increment: pointsEarned },
                                    streak: predictionMatches ? { increment: 1 } : { set: 0 }
                                }
                            })
                        ]);

                        results.push({
                            pickId: pick.id,
                            marketId: mId,
                            player: pick.player,
                            points: pointsEarned,
                            status: 'Resolved'
                        });

                    } catch (e) {
                        console.error(`Failed to resolve pick ${pick.id}`, e);
                        results.push({ pickId: pick.id, status: 'Failed', error: String(e) });
                    }
                }
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Resolution Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
