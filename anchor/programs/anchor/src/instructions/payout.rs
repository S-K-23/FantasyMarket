use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke_signed;
use crate::state::*;
use crate::errors::FflError;

pub fn end_season(ctx: Context<EndSeason>) -> Result<()> {
    let league = &mut ctx.accounts.league;
    // In production, check if all sessions are complete
    league.state = LeagueState::Completed;
    Ok(())
}

pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
    let league = &ctx.accounts.league;
    let player_state = &mut ctx.accounts.player_state;
    let prize_pool_vault = &mut ctx.accounts.prize_pool_vault;
    let player = &mut ctx.accounts.player;

    require!(league.state == LeagueState::Completed, FflError::SessionNotActive); // Reuse error or add LeagueNotCompleted
    require!(!player_state.has_claimed, FflError::Unauthorized); // Reuse error or add AlreadyClaimed
    
    // Calculate payout
    // Payout = (Player Points / Total League Points) * Prize Pool Balance
    
    let total_prize_pool = prize_pool_vault.lamports();
    let player_points = if player_state.points < 0 { 0 } else { player_state.points as u64 };
    let total_league_points = if league.total_points < 0 { 0 } else { league.total_points as u64 };
    
    let payout = if total_league_points > 0 {
        (player_points as u128 * total_prize_pool as u128 / total_league_points as u128) as u64
    } else {
        // If no points (everyone lost?), split equally? Or refund?
        // Let's split equally if total points is 0
        total_prize_pool / (league.players.len() as u64)
    };
    
    if payout > 0 {
        // Transfer from Prize Pool Vault (PDA) to Player
        let league_key = league.key();
        let seeds = &[
            b"prize_pool",
            league_key.as_ref(),
            &[league.bump], // Wait, prize_pool bump? We need to store it or derive it.
            // In create_league, we used seeds = [b"prize_pool", league.key().as_ref()], bump
            // We didn't store the bump in League state for the vault.
            // We can re-derive it here using ctx.bumps if passed, or find_program_address.
            // But invoke_signed needs the bump.
        ];
        
        // Actually, we need the bump for the vault.
        // Let's assume we can get it from the context if we added it to the struct, 
        // or we need to store it in the League account.
        // The League account has `bump` but that's for the league account itself.
        // Let's check `create_league` in lib.rs.
        // It didn't store prize_pool_bump.
        
        // FIX: We should store prize_pool_bump in League or pass it.
        // For now, let's use `ctx.bumps.prize_pool_vault`.
        
        let bump = ctx.bumps.prize_pool_vault;
        let signer_seeds = &[
            b"prize_pool",
            league_key.as_ref(),
            &[bump],
        ];
        
        // We can't use system_instruction::transfer for PDA signer easily with Anchor's transfer wrapper?
        // Anchor doesn't have a helper for system transfer from PDA?
        // We use invoke_signed with system_instruction::transfer.
        
        let ix = system_instruction::transfer(
            &prize_pool_vault.key(),
            &player.key(),
            payout,
        );
        
        invoke_signed(
            &ix,
            &[
                prize_pool_vault.to_account_info(),
                player.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[signer_seeds],
        )?;
    }
    
    player_state.has_claimed = true;
    
    Ok(())
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
    
    #[account(
        mut,
        seeds = [b"prize_pool", league.key().as_ref()],
        bump
    )]
    pub prize_pool_vault: SystemAccount<'info>, // Use SystemAccount for the vault (it's just a PDA with SOL)
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
