use anchor_lang::prelude::*;
use crate::state::Prediction;

#[account]
pub struct TradeProposal {
    pub trade_id: u64,
    pub league_id: u64,
    pub proposer: Pubkey,
    pub receiver: Pubkey,
    pub proposer_pick: Pubkey,
    pub receiver_pick: Pubkey,
    pub status: TradeStatus,
    pub proposed_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

impl TradeProposal {
    pub const LEN: usize = 8 + // discriminator
        8 + // trade_id
        8 + // league_id
        32 + // proposer
        32 + // receiver
        32 + // proposer_pick
        32 + // receiver_pick
        1 + // status
        8 + // proposed_at
        8 + // expires_at
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TradeStatus {
    Pending,
    Accepted,
    Rejected,
    Expired,
    Canceled,
}
