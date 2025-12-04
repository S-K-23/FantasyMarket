use anchor_lang::prelude::*;
use anchor_lang::solana_program::{system_instruction, program::{invoke, invoke_signed}};

pub mod state;
pub mod errors;

use state::*;
use errors::*;

declare_id!("HtJHB7t3esZkEdZhvUHQNYj4RYXrQsGxqzRoyMzmsBJQ");

#[program]
pub mod anchor {
    use super::*;

    pub fn create_league(
        ctx: Context<CreateLeague>,
        league_id: u64,
        buy_in_amount: u64,
        sessions_total: u8,
        rounds_per_session: u8,
    ) -> Result<()> {
        let league = &mut ctx.accounts.league;
        league.league_id = league_id;
        league.creator = ctx.accounts.creator.key();
        league.buy_in_amount = buy_in_amount;
        league.prize_pool_vault = ctx.accounts.prize_pool_vault.key();
        league.sessions_total = sessions_total;
        league.rounds_per_session = rounds_per_session;
        league.current_session = 1;
        league.state = LeagueState::Setup;
        league.created_at = Clock::get()?.unix_timestamp;
        league.updated_at = Clock::get()?.unix_timestamp;
        league.session_picks_count = 0;
        league.bump = ctx.bumps.league;
        
        league.players = Vec::new();
        league.draft_order = Vec::new();

        Ok(())
    }

    pub fn join_league(ctx: Context<JoinLeague>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        let player = &mut ctx.accounts.player;
        let player_state = &mut ctx.accounts.player_state;

        // Checks
        require!(league.state == LeagueState::Setup, FflError::NotSetup);
        require!(league.players.len() < 12, FflError::LeagueFull); // Max 12 players
        require!(!league.players.contains(&player.key()), FflError::AlreadyJoined);

        // Transfer buy-in (SOL)
        let ix = system_instruction::transfer(
            &player.key(),
            &ctx.accounts.prize_pool_vault.key(),
            league.buy_in_amount,
        );
        invoke(
            &ix,
            &[
                player.to_account_info(),
                ctx.accounts.prize_pool_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Initialize PlayerState
        player_state.league_id = league.league_id;
        player_state.player = player.key();
        player_state.points = 0;
        player_state.streak = 0;
        player_state.xp = 0;
        player_state.bonuses = 0;
        player_state.has_claimed = false;
        player_state.bump = ctx.bumps.player_state;

        // Add to league
        league.players.push(player.key());

        Ok(())
    }

    pub fn start_draft(ctx: Context<StartDraft>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        
        require!(league.state == LeagueState::Setup, FflError::NotSetup);
        require!(league.players.len() >= 2, FflError::LeagueFull); // Min 2 players for testing, PRD says 8

        // Randomize draft order (simple pseudo-random using slot/timestamp)
        // In production, use VRF or similar. For MVP/Hackathon, simple shuffle is ok.
        let mut draft_order = league.players.clone();
        let clock = Clock::get()?;
        let seed = clock.unix_timestamp as u64 + clock.slot;
        
        // Simple Fisher-Yates shuffle
        for i in (1..draft_order.len()).rev() {
            let j = (seed % (i as u64 + 1)) as usize;
            draft_order.swap(i, j);
        }
        
        league.draft_order = draft_order;
        league.state = LeagueState::Drafting;
        league.session_picks_count = 0;
        
        Ok(())
    }

    pub fn make_pick(
        ctx: Context<MakePick>,
        market_id: String,
        prediction: Prediction,
        snapshot_odds: u32,
    ) -> Result<()> {
        let league = &mut ctx.accounts.league;
        let draft_pick = &mut ctx.accounts.draft_pick;
        let player = &ctx.accounts.player;

        require!(league.state == LeagueState::Drafting, FflError::NotDrafting);
        
        // Calculate turn
        let total_picks = (league.rounds_per_session as usize) * league.players.len();
        require!((league.session_picks_count as usize) < total_picks, FflError::SessionNotActive);

        let pick_index = league.session_picks_count as usize;
        let round = pick_index / league.players.len();
        let position_in_round = pick_index % league.players.len();
        
        // Snake draft logic
        let player_index = if round % 2 == 0 {
            position_in_round
        } else {
            league.players.len() - 1 - position_in_round
        };
        
        let expected_player = league.draft_order[player_index];
        require!(player.key() == expected_player, FflError::NotYourTurn);

        // Initialize DraftPick
        draft_pick.league_id = league.league_id;
        draft_pick.player = player.key();
        draft_pick.session_index = league.current_session;
        draft_pick.pick_index = league.session_picks_count as u8;
        draft_pick.market_id = market_id;
        draft_pick.prediction = prediction;
        draft_pick.snapshot_odds = snapshot_odds;
        draft_pick.resolved = false;
        draft_pick.final_points = 0;
        draft_pick.bump = ctx.bumps.draft_pick;

        // Update league
        league.session_picks_count += 1;
        
        // Check if session draft is complete
        if league.session_picks_count as usize == total_picks {
            league.state = LeagueState::Active;
        }

        Ok(())
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        _market_id: String,
        outcome: bool,
        final_prob: u32,
    ) -> Result<()> {
        let draft_pick = &mut ctx.accounts.draft_pick;
        let player_state = &mut ctx.accounts.player_state;
        let league = &mut ctx.accounts.league;

        require!(!draft_pick.resolved, FflError::Unauthorized);

        let is_correct = (draft_pick.prediction == Prediction::Yes && outcome) ||
                         (draft_pick.prediction == Prediction::No && !outcome);

        let p_pred = if draft_pick.prediction == Prediction::Yes {
            draft_pick.snapshot_odds as f64 / 10000.0
        } else {
            1.0 - (draft_pick.snapshot_odds as f64 / 10000.0)
        };

        let mut points_change: i64 = 0;

        if is_correct {
            let base = 100.0 * (1.0 - p_pred);
            let multiplier = if p_pred >= 0.70 { 1.0 } else if p_pred >= 0.40 { 1.2 } else { 1.5 };
            points_change = (base * multiplier) as i64;
            
            if p_pred < 0.20 {
                points_change += 10;
                player_state.bonuses += 10;
            }
            
            player_state.streak += 1;
            if player_state.streak % 5 == 0 {
                points_change += 25;
                player_state.bonuses += 25;
            }
            
            let session_idx = draft_pick.session_index as usize;
            if session_idx < player_state.session_stats.len() {
                player_state.session_stats[session_idx].wins += 1;
                if player_state.session_stats[session_idx].wins == league.rounds_per_session {
                    points_change += 50;
                    player_state.bonuses += 50;
                }
            }
        } else {
            points_change = (-30.0 * p_pred) as i64;
            player_state.streak = 0;
            let session_idx = draft_pick.session_index as usize;
            if session_idx < player_state.session_stats.len() {
                player_state.session_stats[session_idx].losses += 1;
            }
        }

        player_state.points += points_change;
        league.total_points += points_change;
        
        draft_pick.resolved = true;
        draft_pick.final_points = points_change as i32;

        Ok(())
    }

    pub fn end_season(ctx: Context<EndSeason>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.state == LeagueState::Active, FflError::SessionNotActive);
        league.state = LeagueState::Completed;
        Ok(())
    }
    
    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let league = &ctx.accounts.league;
        let player_state = &mut ctx.accounts.player_state;
        
        require!(league.state == LeagueState::Completed, FflError::SessionNotActive);
        require!(!player_state.has_claimed, FflError::Unauthorized);
        
        let total_prize_pool = league.buy_in_amount * (league.players.len() as u64);
        let player_points = if player_state.points < 0 { 0 } else { player_state.points as u64 };
        let total_league_points = if league.total_points < 0 { 0 } else { league.total_points as u64 };
        
        let payout = if total_league_points > 0 {
            (player_points as u128 * total_prize_pool as u128 / total_league_points as u128) as u64
        } else {
            total_prize_pool / (league.players.len() as u64)
        };
        
        if payout > 0 {
             let league_key = league.key();
             let seeds = &[
                b"prize_pool",
                league_key.as_ref(),
                &[ctx.bumps.prize_pool_vault],
            ];
            let signer_seeds = &[&seeds[..]];

            let ix = system_instruction::transfer(
                &ctx.accounts.prize_pool_vault.key(),
                &ctx.accounts.player.key(),
                payout,
            );
            invoke_signed(
                &ix,
                &[
                    ctx.accounts.prize_pool_vault.to_account_info(),
                    ctx.accounts.player.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer_seeds,
            )?;
        }
        
        player_state.has_claimed = true;
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(league_id: u64)]
pub struct CreateLeague<'info> {
    #[account(
        init,
        seeds = [b"league", league_id.to_le_bytes().as_ref()],
        bump,
        payer = creator,
        space = League::LEN
    )]
    pub league: Account<'info, League>,
    
    /// CHECK: PDA for prize pool vault
    #[account(
        seeds = [b"prize_pool", league.key().as_ref()],
        bump
    )]
    pub prize_pool_vault: AccountInfo<'info>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinLeague<'info> {
    #[account(mut)]
    pub league: Account<'info, League>,
    
    #[account(
        init,
        seeds = [b"player_state", league.key().as_ref(), player.key().as_ref()],
        bump,
        payer = player,
        space = PlayerState::LEN
    )]
    pub player_state: Account<'info, PlayerState>,
    
    /// CHECK: PDA for prize pool vault
    #[account(
        mut,
        seeds = [b"prize_pool", league.key().as_ref()],
        bump
    )]
    pub prize_pool_vault: AccountInfo<'info>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartDraft<'info> {
    #[account(mut)]
    pub league: Account<'info, League>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(market_id: String, prediction: Prediction)]
pub struct MakePick<'info> {
    #[account(mut)]
    pub league: Account<'info, League>,
    
    #[account(
        init,
        seeds = [
            b"draft_pick", 
            league.key().as_ref(), 
            &[league.current_session], 
            market_id.as_bytes(),
            &[match prediction { Prediction::Yes => 1, Prediction::No => 0 }]
        ],
        bump,
        payer = player,
        space = DraftPick::LEN
    )]
    pub draft_pick: Account<'info, DraftPick>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: String)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub league: Account<'info, League>,
    #[account(mut)]
    pub draft_pick: Account<'info, DraftPick>,
    #[account(mut)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut)]
    pub signer: Signer<'info>, 
}

#[derive(Accounts)]
pub struct EndSeason<'info> {
    #[account(mut)]
    pub league: Account<'info, League>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub league: Account<'info, League>,
    #[account(mut)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut, seeds = [b"prize_pool", league.key().as_ref()], bump)]
    pub prize_pool_vault: AccountInfo<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}
