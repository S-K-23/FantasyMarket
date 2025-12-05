use anchor_lang::prelude::*;

pub fn calculate_multiplier(p_pred: f64) -> f64 {
    if p_pred >= 0.70 {
        1.0
    } else if p_pred >= 0.40 {
        1.2
    } else {
        1.5
    }
}

pub fn calculate_win_points(p_pred: f64) -> i64 {
    let base = 100.0 * (1.0 - p_pred);
    let multiplier = calculate_multiplier(p_pred);
    (base * multiplier) as i64
}

pub fn calculate_loss_points(p_pred: f64) -> i64 {
    (-30.0 * p_pred) as i64
}

pub fn calculate_bonuses(
    p_pred: f64,
    is_correct: bool,
    current_streak: u16,
    session_wins: u8,
    rounds_per_session: u8,
) -> (i64, u32) {
    let mut bonus_points: i64 = 0;
    let mut bonus_tracker: u32 = 0;

    if is_correct {
        // Long-shot bonus
        if p_pred < 0.20 {
            bonus_points += 10;
            bonus_tracker += 10;
        }

        // Streak bonus (every 5)
        // Note: current_streak is the streak BEFORE this win. So new streak is current_streak + 1.
        let new_streak = current_streak + 1;
        if new_streak % 5 == 0 {
            bonus_points += 25;
            bonus_tracker += 25;
        }

        // Clean sweep bonus
        // session_wins is wins BEFORE this one. So new wins = session_wins + 1.
        if session_wins + 1 == rounds_per_session {
            bonus_points += 50;
            bonus_tracker += 50;
        }
    }

    (bonus_points, bonus_tracker)
}
