use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::FflError;
use super::scoring::*;

pub fn resolve_market(
    ctx: Context<ResolveMarket>,
    _market_id: String,
    outcome: bool,
    final_prob: u32, // Not used in formula but good for records?
) -> Result<()> {
    let draft_pick = &mut ctx.accounts.draft_pick;
    let player_state = &mut ctx.accounts.player_state;
    let league = &mut ctx.accounts.league;

    require!(!draft_pick.resolved, FflError::Unauthorized); // Should be "AlreadyResolved" but reusing Unauthorized for now or add new error

    let is_correct = (draft_pick.prediction == Prediction::Yes && outcome) ||
                     (draft_pick.prediction == Prediction::No && !outcome);

    // Calculate p_pred (probability of the PREDICTED outcome at draft time)
    let p_pred = if draft_pick.prediction == Prediction::Yes {
        draft_pick.snapshot_odds as f64 / 10000.0
    } else {
        1.0 - (draft_pick.snapshot_odds as f64 / 10000.0)
    };

    let mut points_change: i64 = 0;
    let mut bonuses_earned: u32 = 0;

    if is_correct {
        points_change = calculate_win_points(p_pred);
        
        let session_idx = draft_pick.session_index as usize;
        let current_wins = if session_idx < player_state.session_stats.len() {
            player_state.session_stats[session_idx].wins
        } else {
            0
        };

        let (bonus_pts, bonus_val) = calculate_bonuses(
            p_pred, 
            true, 
            player_state.streak, 
            current_wins, 
            league.rounds_per_session
        );
        
        points_change += bonus_pts;
        bonuses_earned = bonus_val;

        player_state.streak += 1;
        
        if session_idx < player_state.session_stats.len() {
            player_state.session_stats[session_idx].wins += 1;
        }
    } else {
        points_change = calculate_loss_points(p_pred);
        player_state.streak = 0;
        
        let session_idx = draft_pick.session_index as usize;
        if session_idx < player_state.session_stats.len() {
            player_state.session_stats[session_idx].losses += 1;
        }
    }

    player_state.points += points_change;
    player_state.bonuses += bonuses_earned;
    league.total_points += points_change;
    
    draft_pick.resolved = true;
    draft_pick.final_points = points_change as i32;

    Ok(())
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
