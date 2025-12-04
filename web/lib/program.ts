import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN, utils } from '@coral-xyz/anchor';
import { WalletContextState } from '@solana/wallet-adapter-react';

// Program ID from lib.rs
export const PROGRAM_ID = new PublicKey("HtJHB7t3esZkEdZhvUHQNYj4RYXrQsGxqzRoyMzmsBJQ");

// Full IDL matching the Anchor program for Anchor 0.30+
// The key for types is using the new format with "name" as identifier
const IDL: any = {
    "address": "HtJHB7t3esZkEdZhvUHQNYj4RYXrQsGxqzRoyMzmsBJQ",
    "metadata": {
        "name": "anchor",
        "version": "0.1.0",
        "spec": "0.1.0"
    },
    "instructions": [
        {
            "name": "join_league",
            "discriminator": [0, 0, 0, 0, 0, 0, 0, 0],
            "accounts": [
                { "name": "league", "writable": true },
                { "name": "player_state", "writable": true },
                { "name": "treasury", "writable": true },
                { "name": "player", "writable": true, "signer": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": []
        },
        {
            "name": "make_pick",
            "discriminator": [0, 0, 0, 0, 0, 0, 0, 1],
            "accounts": [
                { "name": "league", "writable": true },
                { "name": "draft_pick", "writable": true },
                { "name": "player", "writable": true, "signer": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": [
                { "name": "market_id", "type": "string" },
                { "name": "prediction", "type": { "defined": { "name": "Prediction" } } },
                { "name": "snapshot_odds", "type": "u32" }
            ]
        },
        {
            "name": "distribute_payout",
            "discriminator": [0, 0, 0, 0, 0, 0, 0, 2],
            "accounts": [
                { "name": "league", "writable": true },
                { "name": "player_state", "writable": true },
                { "name": "treasury", "writable": true, "signer": true },
                { "name": "player", "writable": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": []
        }
    ],
    "types": [
        {
            "name": "Prediction",
            "type": {
                "kind": "enum",
                "variants": [
                    { "name": "Yes" },
                    { "name": "No" }
                ]
            }
        }
    ]
};

export const getProgram = (connection: Connection, wallet: any) => {
    const provider = new AnchorProvider(connection, wallet, {});
    return new Program(IDL, provider);
};

export const joinLeague = async (
    wallet: WalletContextState,
    connection: Connection,
    leagueId: number,
    treasuryKey: PublicKey
) => {
    if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");

    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program(IDL, provider);

    const [leaguePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("league"), new BN(leagueId).toArrayLike(Buffer, 'le', 8)],
        PROGRAM_ID
    );

    const [playerStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player_state"), leaguePda.toBuffer(), wallet.publicKey.toBuffer()],
        PROGRAM_ID
    );

    try {
        const tx = await program.methods.joinLeague()
            .accounts({
                league: leaguePda,
                playerState: playerStatePda,
                treasury: treasuryKey,
                player: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    } catch (error) {
        console.error("Join League Error:", error);
        throw error;
    }
};

export const makePick = async (
    wallet: WalletContextState,
    connection: Connection,
    leagueId: number,
    currentSession: number,
    marketId: string,
    prediction: 'Yes' | 'No',
    snapshotOdds: number
) => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");

    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program(IDL, provider);

    const [leaguePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("league"), new BN(leagueId).toArrayLike(Buffer, 'le', 8)],
        PROGRAM_ID
    );

    // Prediction enum for Anchor - use the enum variant name
    const predictionArg = prediction === 'Yes' ? { yes: {} } : { no: {} };
    // For seeds: match prediction { Prediction::Yes => 1, Prediction::No => 0 } in lib.rs
    const predictionSeed = prediction === 'Yes' ? 1 : 0;

    const [draftPickPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("draft_pick"),
            leaguePda.toBuffer(),
            new Uint8Array([currentSession]),
            Buffer.from(marketId),
            new Uint8Array([predictionSeed])
        ],
        PROGRAM_ID
    );

    try {
        const tx = await program.methods.makePick(marketId, predictionArg, snapshotOdds)
            .accounts({
                league: leaguePda,
                draftPick: draftPickPda,
                player: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return tx;
    } catch (error) {
        console.error("Make Pick Error:", error);
        throw error;
    }
};

export const distributePayout = async (
    connection: Connection,
    treasuryWallet: any, // Keypair or Wallet
    leagueId: number,
    playerAddress: PublicKey
) => {
    const provider = new AnchorProvider(connection, treasuryWallet, {});
    const program = new Program(IDL, provider);

    const [leaguePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("league"), new BN(leagueId).toArrayLike(Buffer, 'le', 8)],
        PROGRAM_ID
    );

    const [playerStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("player_state"), leaguePda.toBuffer(), playerAddress.toBuffer()],
        PROGRAM_ID
    );

    try {
        const tx = await program.methods.distributePayout()
            .accounts({
                league: leaguePda,
                playerState: playerStatePda,
                treasury: treasuryWallet.publicKey,
                player: playerAddress,
                systemProgram: SystemProgram.programId,
            })
            .signers([treasuryWallet.payer || treasuryWallet])
            .rpc();

        return tx;
    } catch (error) {
        console.error("Distribute Payout Error:", error);
        throw error;
    }
};
