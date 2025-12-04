use anchor_lang::prelude::*;

#[error_code]
pub enum FflError {
    #[msg("League is full")]
    LeagueFull,
    #[msg("League is not in setup state")]
    NotSetup,
    #[msg("League is not in drafting state")]
    NotDrafting,
    #[msg("Not your turn to pick")]
    NotYourTurn,
    #[msg("Market already drafted")]
    MarketTaken,
    #[msg("Session not active")]
    SessionNotActive,
    #[msg("Already joined")]
    AlreadyJoined,
    #[msg("Invalid prediction")]
    InvalidPrediction,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
}
