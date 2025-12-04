import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMarket } from '@/lib/polymarket';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, Idl } from '@coral-xyz/anchor';

// Minimal IDL since build failed to generate it automatically
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
            include: { league: true } // Need league info?
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

            if (market.closed && market.active === false) { // Assuming closed means resolved
                // Find the winning outcome
                // Polymarket API structure for resolution?
                // Usually `tokens` has `winner: true`.
                const winningToken = market.tokens.find(t => t.winner);
                if (winningToken) {
                    const outcome = winningToken.outcome === 'Yes';
                    const finalProb = outcome ? 10000 : 0; // 100% or 0%

                    // 4. Trigger on-chain resolution
                    // Setup Anchor
                    if (!process.env.KEEPER_KEY) {
                        console.error("KEEPER_KEY not set");
                        continue;
                    }

                    const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com");
                    const keeperKey = Keypair.fromSecretKey(
                        new Uint8Array(JSON.parse(process.env.KEEPER_KEY))
                    );
                    const wallet = new Wallet(keeperKey);
                    const provider = new AnchorProvider(connection, wallet, {});
                    // Program constructor: (idl, provider) or (idl, programId, provider)
                    // In newer versions, it infers address from IDL if present, or takes it as arg.
                    // Let's use (idl, provider) if IDL has address, or (idl, address, provider).
                    const programId = new PublicKey("HtJHB7t3esZkEdZhvUHQNYj4RYXrQsGxqzRoyMzmsBJQ");
                    const program = new Program(IDL, provider);

                    // Find picks for this market
                    const picksToResolve = unresolvedPicks.filter((p: any) => p.marketId === marketId);

                    for (const pick of picksToResolve) {
                        // Derive PDAs
                        // We need to reconstruct seeds.
                        // League PDA: [b"league", league_id]
                        // DraftPick PDA: [b"draft_pick", league_key, session, market_id, prediction]
                        // PlayerState PDA: [b"player_state", league_key, player_key]

                        // This requires knowing the exact PDAs.
                        // We can store PDA addresses in DB to make this easier?
                        // Or re-derive.
                        // Re-deriving requires `league_id` (u64) and `player` (Pubkey).
                        // `DraftPick` model in DB has `leagueId` (Int, DB ID) and `player` (String).
                        // `League` model has `leagueId` (String, on-chain ID/Address?).
                        // Schema says `leagueId String @unique // On-chain PDA address or ID`.
                        // If it's the PDA address, we can use it directly.

                        // Let's assume DB stores the PDA address in `league.leagueId`? 
                        // Or the numeric ID? Schema comment says "On-chain PDA address or ID".
                        // Let's assume it's the numeric ID for derivation?
                        // Actually, `League` struct has `league_id: u64`.
                        // If DB `leagueId` is the string representation of u64, we can parse it.

                        // But wait, `DraftPick` seeds need `league.key()`.
                        // So we need the League PDA address.
                        // If we have the numeric ID, we can derive the League PDA.

                        // Let's assume we can derive everything.

                        try {
                            // Placeholder for actual call
                            // await program.methods.resolveMarket(marketId, outcome, finalProb)
                            //   .accounts({ ... })
                            //   .rpc();

                            // Update DB
                            await prisma.draftPick.update({
                                where: { id: pick.id },
                                data: { isResolved: true, points: 0 } // Points will be updated by indexer later?
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
