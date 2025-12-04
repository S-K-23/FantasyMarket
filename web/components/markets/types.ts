export interface Market {
    market_id: string;
    title: string;
    description: string;
    category: string;
    end_date: string;
    current_price_yes: number;
    current_price_no: number;
    liquidity: number;
    volume: number;
    polymarket_url: string;
    outcomes: string[];
    active: boolean;
    token_id_yes?: string;
    token_id_no?: string;
}

export interface DraftPick {
    id?: number;
    league_id: number;
    market_id: string;
    player: string;
    prediction: 'YES' | 'NO';
    session: number;
    pick_index: number;
    snapshot_odds: number; // 0-1 probability
    points?: number;
    is_resolved: boolean;
}

export interface MarketWithDraftStatus extends Market {
    yes_taken: boolean;
    no_taken: boolean;
    drafted_by?: {
        player_address: string;
        prediction: 'YES' | 'NO';
    }[];
}
