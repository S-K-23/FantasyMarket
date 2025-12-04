use anchor_lang::prelude::*;

#[account]
pub struct League {
    pub league_id: u64,
    pub creator: Pubkey,
    pub buy_in_amount: u64,
    pub prize_pool_vault: Pubkey,
    pub players: Vec<Pubkey>,
    pub draft_order: Vec<Pubkey>,
    pub sessions_total: u8,
    pub rounds_per_session: u8,
    pub current_session: u8,
    pub state: LeagueState,
    pub created_at: i64,
    pub updated_at: i64,
    pub session_picks_count: u16,
    pub total_points: i64,
    pub bump: u8,
}

impl League {
    pub const LEN: usize = 8 + // discriminator
        8 + // league_id
        32 + // creator
        8 + // buy_in_amount
        32 + // prize_pool_vault
        4 + (32 * 12) + // players (max 12)
        4 + (32 * 12) + // draft_order (max 12)
        1 + // sessions_total
        1 + // rounds_per_session
        1 + // current_session
        1 + // state (enum)
        8 + // created_at
        8 + // updated_at
        2 + // session_picks_count
        8 + // total_points
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LeagueState {
    Setup,
    Drafting,
    Active,
    Completed,
}

#[account]
pub struct PlayerState {
    pub league_id: u64,
    pub player: Pubkey,
    pub points: i64,
    pub streak: u16,
    pub xp: u32,
    pub bonuses: u32,
    pub has_claimed: bool,
    pub session_stats: [SessionStat; 16], // Max 16 sessions
    pub bump: u8,
}

impl PlayerState {
    pub const LEN: usize = 8 + 
        8 + // league_id
        32 + // player
        8 + // points
        2 + // streak
        4 + // xp
        4 + // bonuses
        1 + // has_claimed
        (16 * 2) + // session_stats
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub struct SessionStat {
    pub wins: u8,
    pub losses: u8,
}

#[account]
pub struct DraftPick {
    pub league_id: u64,
    pub player: Pubkey,
    pub session_index: u8,
    pub pick_index: u8,
    pub market_id: String,
    pub prediction: Prediction,
    pub snapshot_odds: u32, // Scaled by 10000 (basis points)
    pub resolved: bool,
    pub final_points: i32,
    pub bump: u8,
}

impl DraftPick {
    // market_id is String, so size is variable. We need to set a max length.
    // Let's assume max 32 chars for market ID if it's a hash, or allocate more.
    // Polymarket IDs are often long strings or integers.
    // Let's allocate 64 bytes for market_id string.
    pub const LEN: usize = 8 + 
        8 + // league_id
        32 + // player
        1 + // session_index
        1 + // pick_index
        4 + 64 + // market_id (max 64 chars)
        1 + // prediction
        4 + // snapshot_odds
        1 + // resolved
        4 + // final_points
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Prediction {
    Yes,
    No,
}
