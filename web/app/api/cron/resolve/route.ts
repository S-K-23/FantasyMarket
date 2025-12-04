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

export async function GET() {
    try {
        // 1. Fetch unresolved picks
        const unresolvedPicks = await prisma.draftPick.findMany({
            where: { isResolved: false },
            include: { league: true }
        });

        if (unresolvedPicks.length === 0) {
            return NextResponse.json({ message: 'No unresolved picks' });
        }

        // 2. Group by marketId
        const marketIds = [...new Set(unresolvedPicks.map((p: any) => p.marketId))];
        const results: any[] = [];

        // 3. Check Polymarket
        for (const marketId of marketIds) {
            const market = await getMarket(marketId as string);
            if (!market) continue;

            if (market.closed && market.active === false) {
                // Find the winning outcome
                const winningToken = market.tokens.find(t => t.winner);
                if (winningToken) {
                    const outcome = winningToken.outcome === 'Yes';
                    const finalProb = outcome ? 10000 : 0;

                    // 4. Trigger on-chain resolution
                    if (!process.env.KEEPER_KEY) {
                        console.error("KEEPER_KEY not set");
                        continue;
                    }

                    const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com");
                    const keeperKey = Keypair.fromSecretKey(
                        new Uint8Array(JSON.parse(process.env.KEEPER_KEY))
                    );
                    const wallet = new NodeWallet(keeperKey);
                    const provider = new AnchorProvider(connection, wallet, {});
                    const program = new Program(IDL, provider);

                    // Find picks for this market
                    const picksToResolve = unresolvedPicks.filter((p: any) => p.marketId === marketId);

                    for (const pick of picksToResolve) {
                        try {
                            // Derive PDAs
                            // League PDA: [b"league", league_id]
                            const leagueIdBN = new BN(pick.league.leagueId); // Assuming leagueId in DB is string of u64
                            const [leaguePda] = PublicKey.findProgramAddressSync(
                                [Buffer.from("league"), leagueIdBN.toArrayLike(Buffer, 'le', 8)],
                                program.programId
                            );

                            // PlayerState PDA: [b"player_state", league_key, player_key]
                            const playerKey = new PublicKey(pick.player);
                            const [playerStatePda] = PublicKey.findProgramAddressSync(
                                [Buffer.from("player_state"), leaguePda.toBuffer(), playerKey.toBuffer()],
                                program.programId
                            );

                            // DraftPick PDA: [b"draft_pick", league_key, session, market_id, prediction]
                            // Prediction seed: Yes=1, No=0
                            const predictionSeed = pick.prediction === 'YES' ? 1 : 0;
                            const [draftPickPda] = PublicKey.findProgramAddressSync(
                                [
                                    Buffer.from("draft_pick"),
                                    leaguePda.toBuffer(),
                                    new Uint8Array([pick.session]),
                                    Buffer.from(pick.marketId),
                                    new Uint8Array([predictionSeed])
                                ],
                                program.programId
                            );

                            await program.methods.resolveMarket(marketId, outcome, finalProb)
                                .accounts({
                                    league: leaguePda,
                                    draftPick: draftPickPda,
                                    playerState: playerStatePda,
                                    signer: keeperKey.publicKey
                                })
                                .rpc();

                            // Update DB
                            await prisma.draftPick.update({
                                where: { id: pick.id },
                                data: { isResolved: true }
                            });

                            results.push({ marketId, status: 'Resolved', pickId: pick.id });
                        } catch (e) {
                            console.error(`Failed to resolve pick ${pick.id}`, e);
                            results.push({ marketId, status: 'Failed', error: String(e) });
                        }
                    }
                }
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Cron Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
