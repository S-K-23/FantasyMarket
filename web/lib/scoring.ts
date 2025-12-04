/**
 * Scoring Library - Implements PRD Section 4.x Scoring Rules
 * 
 * This module handles all FFL scoring calculations including:
 * - Draft time probability calculations
 * - Live score tracking
 * - Final point calculations
 * - Bonuses (long-shot, streak, clean sweep)
 */

export type Prediction = 'YES' | 'NO';

/**
 * Section 4.1: Calculate draft-time probability for a prediction
 * 
 * @param prediction - The player's prediction (YES or NO)
 * @param snapshotOdds - The YES probability at draft time (0-1)
 * @returns The probability of the predicted outcome (0-1)
 */
export function calculateDraftTimeProb(
    prediction: Prediction,
    snapshotOdds: number
): number {
    return prediction === 'YES' ? snapshotOdds : 1 - snapshotOdds;
}

/**
 * Section 4.2: Calculate live (unrealized) score
 * 
 * Formula:
 * - For YES predictions: 100 * (pCurrent - p0)
 * - For NO predictions: 100 * (p0 - pCurrent)
 * 
 * @param prediction - The player's prediction
 * @param p0 - YES probability at draft time (0-1)
 * @param pCurrent - Current YES probability (0-1)
 * @returns Live score (can be negative)
 */
export function calculateLiveScore(
    prediction: Prediction,
    p0: number,
    pCurrent: number
): number {
    if (prediction === 'YES') {
        return 100 * (pCurrent - p0);
    } else {
        return 100 * (p0 - pCurrent);
    }
}

/**
 * Get multiplier based on prediction probability tier
 * 
 * Tiers:
 * - Favorite (pPred >= 70%): 1.0x
 * - Balanced (40% <= pPred < 70%): 1.2x
 * - Long-shot (pPred < 40%): 1.5x
 */
function getMultiplier(pPred: number): number {
    if (pPred >= 0.70) return 1.0;  // Favorite
    if (pPred >= 0.40) return 1.2;  // Balanced
    return 1.5;                      // Long-shot
}

/**
 * Get the tier name for display purposes
 */
export function getTierName(pPred: number): 'Favorite' | 'Balanced' | 'Long-shot' {
    if (pPred >= 0.70) return 'Favorite';
    if (pPred >= 0.40) return 'Balanced';
    return 'Long-shot';
}

/**
 * Section 4.3: Calculate final points after market resolution
 * 
 * If correct:
 *   basePoints = 100 * (1 - pPred)
 *   finalPoints = basePoints * multiplier
 * 
 * If incorrect:
 *   finalPoints = -30 * pPred
 * 
 * @param correct - Whether the prediction was correct
 * @param pPred - Probability of the predicted outcome at draft time (0-1)
 * @returns Final points (rounded)
 */
export function calculateFinalPoints(
    correct: boolean,
    pPred: number
): number {
    if (correct) {
        const base = 100 * (1 - pPred);
        const multiplier = getMultiplier(pPred);
        return Math.round(base * multiplier);
    } else {
        return Math.round(-30 * pPred);
    }
}

/**
 * Section 4.4: Check for long-shot bonus
 * 
 * +10 bonus if:
 * - Prediction was correct AND
 * - pPred < 20%
 * 
 * @param correct - Whether the prediction was correct
 * @param pPred - Probability of the predicted outcome at draft time (0-1)
 * @returns Bonus points (0 or 10)
 */
export function checkLongshotBonus(
    correct: boolean,
    pPred: number
): number {
    return (correct && pPred < 0.20) ? 10 : 0;
}

/**
 * Calculate streak bonus
 * 
 * Every 5 consecutive correct predictions = +25 points
 * 
 * @param consecutiveCorrect - Number of consecutive correct predictions
 * @returns Bonus points
 */
export function calculateStreakBonus(
    consecutiveCorrect: number
): number {
    return Math.floor(consecutiveCorrect / 5) * 25;
}

/**
 * Check for clean sweep bonus
 * 
 * +50 bonus if all picks in a session (minimum 5) are correct
 * 
 * @param sessionPicks - Array of picks with their correct status
 * @returns Bonus points (0 or 50)
 */
export function checkCleanSweepBonus(
    sessionPicks: Array<{ correct: boolean }>
): number {
    if (sessionPicks.length < 5) return 0;
    const allCorrect = sessionPicks.every(p => p.correct);
    return allCorrect ? 50 : 0;
}

/**
 * Calculate estimated points if a prediction is correct
 * Used for preview in the UI before drafting
 * 
 * @param prediction - The prediction (YES or NO)
 * @param currentYesPrice - Current YES probability (0-1)
 * @returns Estimated points if correct
 */
export function estimatePointsIfCorrect(
    prediction: Prediction,
    currentYesPrice: number
): { points: number; tier: string; multiplier: number } {
    const pPred = prediction === 'YES' ? currentYesPrice : 1 - currentYesPrice;
    const base = 100 * (1 - pPred);
    const multiplier = getMultiplier(pPred);
    const points = Math.round(base * multiplier);
    const tier = getTierName(pPred);

    return { points, tier, multiplier };
}

/**
 * Calculate estimated penalty if a prediction is wrong
 * 
 * @param prediction - The prediction (YES or NO)
 * @param currentYesPrice - Current YES probability (0-1)
 * @returns Estimated penalty (negative number)
 */
export function estimatePenaltyIfWrong(
    prediction: Prediction,
    currentYesPrice: number
): number {
    const pPred = prediction === 'YES' ? currentYesPrice : 1 - currentYesPrice;
    return Math.round(-30 * pPred);
}

/**
 * Example calculations for testing:
 * 
 * Market: "Will X win?" at 70% YES
 * 
 * If player drafts YES (pPred = 0.70):
 * - Tier: Favorite (1.0x)
 * - If correct: 100 * (1 - 0.70) * 1.0 = 30 points
 * - If wrong: -30 * 0.70 = -21 points
 * 
 * If player drafts NO (pPred = 0.30):
 * - Tier: Long-shot (1.5x)
 * - If correct: 100 * (1 - 0.30) * 1.5 = 105 points
 * - If wrong: -30 * 0.30 = -9 points
 * 
 * Market: "Will Y happen?" at 15% YES
 * 
 * If player drafts YES (pPred = 0.15):
 * - Tier: Long-shot (1.5x)
 * - If correct: 100 * (1 - 0.15) * 1.5 = 127.5 ≈ 128 points
 * - Long-shot bonus: +10 (since pPred < 20%)
 * - Total if correct: 138 points
 * - If wrong: -30 * 0.15 = -4.5 ≈ -5 points
 */
