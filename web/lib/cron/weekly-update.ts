import { prisma } from '@/lib/prisma';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
// @ts-ignore
import idl from '@/lib/idl.json';

// Simple Wallet implementation for backend use
class NodeWallet {
    constructor(readonly payer: Keypair) { }
    get publicKey(): PublicKey { return this.payer.publicKey; }
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
        if (tx instanceof Transaction) { tx.partialSign(this.payer); }
        return tx;
    }
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
        return txs.map((tx) => { if (tx instanceof Transaction) tx.partialSign(this.payer); return tx; });
    }
}

// Polymarket Gamma API
const GAMMA_API = 'https://gamma-api.polymarket.com/markets';

export async function runWeeklyUpdate() {
    console.log('Starting weekly update...');

    // 1. Fetch active leagues
    const leagues = await prisma.league.findMany({
        where: {
            status: {
                in: ['ACTIVE', 'DRAFTING'], // Include DRAFTING? Maybe not.
            }
        },
        include: {
            draftPicks: {
                where: {
                    isResolved: false
                },
                include: {
                    market: true
                }
            }
        }
    });

    console.log(`Found ${leagues.length} active leagues.`);

    // Setup Anchor Provider
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com');
    // We need a backend wallet to sign resolution transactions
    // For hackathon, we can use a local keypair file or env var
    // process.env.BACKEND_WALLET_KEY should be a JSON array of numbers
    if (!process.env.BACKEND_WALLET_KEY) {
        console.error('BACKEND_WALLET_KEY not found');
        return;
    }

    const walletKey = Uint8Array.from(JSON.parse(process.env.BACKEND_WALLET_KEY));
    const wallet = new NodeWallet(Keypair.fromSecretKey(walletKey));
    const provider = new AnchorProvider(connection, wallet, {});
    const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
    // @ts-ignore
    const program = new Program(idl as Idl, provider);

    for (const league of leagues) {
        console.log(`Processing league ${league.id}...`);

        // Group picks by market to avoid duplicate API calls
        const marketMap = new Map();
        for (const pick of league.draftPicks) {
            if (!marketMap.has(pick.marketId)) {
                marketMap.set(pick.marketId, []);
            }
            marketMap.get(pick.marketId).push(pick);
        }

        for (const [marketId, picks] of marketMap) {
            try {
                // 2. Query Polymarket API
                const response = await fetch(`${GAMMA_API}/${marketId}`);
                if (!response.ok) continue;

                const marketData = await response.json();

                // Check if resolved
                if (marketData.closed && marketData.resolvedAt) {
                    console.log(`Market ${marketId} is resolved. Outcome: ${marketData.outcome}`);

                    const outcomeBool = marketData.outcome === 'YES'; // Handle INVALID?
                    // If INVALID, maybe refund or void? For now assume YES/NO.

                    // 3. Resolve on-chain
                    for (const pick of picks) {
                        try {
                            // Derive PDAs
                            const [draftPickPda] = PublicKey.findProgramAddressSync(
                                [
                                    Buffer.from("draft_pick"),
                                    new BN(league.leagueId).toArrayLike(Buffer, 'le', 8),
                                    Buffer.from([pick.session]),
                                    Buffer.from(pick.marketId),
                                    Buffer.from([pick.prediction === 'YES' ? 1 : 0])
                                ],
                                programId
                            );

                            const [playerStatePda] = PublicKey.findProgramAddressSync(
                                [
                                    Buffer.from("player_state"),
                                    new BN(league.leagueId).toArrayLike(Buffer, 'le', 8),
                                    new PublicKey(pick.player).toBuffer()
                                ],
                                programId
                            );

                            const [leaguePda] = PublicKey.findProgramAddressSync(
                                [Buffer.from("league"), new BN(league.leagueId).toArrayLike(Buffer, 'le', 8)],
                                programId
                            );

                            // Call resolve_market
                            await program.methods
                                .resolveMarket(
                                    pick.marketId,
                                    outcomeBool,
                                    0 // final_prob (not used yet)
                                )
                                .accounts({
                                    league: leaguePda,
                                    draftPick: draftPickPda,
                                    playerState: playerStatePda,
                                    signer: wallet.publicKey,
                                })
                                .rpc();

                            console.log(`Resolved pick ${pick.id} on-chain.`);

                            // 4. Update Database
                            await prisma.draftPick.update({
                                where: { id: pick.id },
                                data: { isResolved: true }
                            });

                        } catch (err) {
                            console.error(`Failed to resolve pick ${pick.id}:`, err);
                        }
                    }

                    // Update Market in DB
                    await prisma.market.update({
                        where: { id: marketId },
                        data: {
                            resolution: marketData.outcome,
                            resolvedAt: new Date(marketData.resolvedAt),
                            active: false
                        }
                    });
                }
            } catch (error) {
                console.error(`Error processing market ${marketId}:`, error);
            }
        }
    }

    console.log('Weekly update complete.');
}
