use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::FflError;

pub fn propose_trade(
    ctx: Context<ProposeTrade>,
    trade_id: u64,
) -> Result<()> {
    let trade_proposal = &mut ctx.accounts.trade_proposal;
    let proposer_pick = &ctx.accounts.proposer_pick;
    let receiver_pick = &ctx.accounts.receiver_pick;
    let league = &ctx.accounts.league;

    // Validate picks belong to the correct players
    require!(proposer_pick.player == ctx.accounts.proposer.key(), FflError::Unauthorized);
    require!(receiver_pick.player == ctx.accounts.receiver.key(), FflError::Unauthorized);
    
    // Validate picks are in the correct league
    require!(proposer_pick.league_id == league.league_id, FflError::Unauthorized);
    require!(receiver_pick.league_id == league.league_id, FflError::Unauthorized);

    // Validate picks are unresolved
    require!(!proposer_pick.resolved, FflError::PickResolved);
    require!(!receiver_pick.resolved, FflError::PickResolved);

    trade_proposal.trade_id = trade_id;
    trade_proposal.league_id = league.league_id;
    trade_proposal.proposer = ctx.accounts.proposer.key();
    trade_proposal.receiver = ctx.accounts.receiver.key();
    trade_proposal.proposer_pick = proposer_pick.key();
    trade_proposal.receiver_pick = receiver_pick.key();
    trade_proposal.status = TradeStatus::Pending;
    trade_proposal.proposed_at = Clock::get()?.unix_timestamp;
    trade_proposal.expires_at = Clock::get()?.unix_timestamp + 86400; // 24 hours
    trade_proposal.bump = ctx.bumps.trade_proposal;

    Ok(())
}

pub fn respond_to_trade(
    ctx: Context<RespondToTrade>,
    accept: bool,
) -> Result<()> {
    let trade_proposal = &mut ctx.accounts.trade_proposal;
    let proposer_pick = &mut ctx.accounts.proposer_pick;
    let receiver_pick = &mut ctx.accounts.receiver_pick;
    let respondent = &ctx.accounts.respondent;

    // Validate trade status
    require!(trade_proposal.status == TradeStatus::Pending, FflError::TradeNotPending);
    
    // Validate expiration
    if Clock::get()?.unix_timestamp > trade_proposal.expires_at {
        trade_proposal.status = TradeStatus::Expired;
        return Err(FflError::TradeExpired.into());
    }

    // Validate respondent is the receiver
    require!(respondent.key() == trade_proposal.receiver, FflError::NotTradeParty);

    // Validate picks match proposal
    require!(proposer_pick.key() == trade_proposal.proposer_pick, FflError::PickNotFound);
    require!(receiver_pick.key() == trade_proposal.receiver_pick, FflError::PickNotFound);

    // Validate picks are still unresolved
    require!(!proposer_pick.resolved, FflError::PickResolved);
    require!(!receiver_pick.resolved, FflError::PickResolved);

    if accept {
        // Swap owners
        let proposer = trade_proposal.proposer;
        let receiver = trade_proposal.receiver;

        // Double check current owners (in case they traded away already? But PDAs are locked by seeds... wait, seeds don't include owner)
        // If they traded away, the owner field would be different.
        require!(proposer_pick.player == proposer, FflError::Unauthorized);
        require!(receiver_pick.player == receiver, FflError::Unauthorized);

        proposer_pick.player = receiver;
        receiver_pick.player = proposer;

        trade_proposal.status = TradeStatus::Accepted;
    } else {
        trade_proposal.status = TradeStatus::Rejected;
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct ProposeTrade<'info> {
    #[account(mut)]
    pub league: Account<'info, League>,
    
    #[account(
        init,
        seeds = [b"trade", league.key().as_ref(), trade_id.to_le_bytes().as_ref()],
        bump,
        payer = proposer,
        space = TradeProposal::LEN
    )]
    pub trade_proposal: Account<'info, TradeProposal>,

    #[account(mut)]
    pub proposer: Signer<'info>,
    
    /// CHECK: Validated in instruction
    pub receiver: AccountInfo<'info>,

    #[account(mut)]
    pub proposer_pick: Account<'info, DraftPick>,
    
    #[account(mut)]
    pub receiver_pick: Account<'info, DraftPick>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RespondToTrade<'info> {
    #[account(mut)]
    pub trade_proposal: Account<'info, TradeProposal>,

    #[account(mut)]
    pub respondent: Signer<'info>, // The receiver of the trade

    #[account(mut)]
    pub proposer_pick: Account<'info, DraftPick>,
    
    #[account(mut)]
    pub receiver_pick: Account<'info, DraftPick>,
}
