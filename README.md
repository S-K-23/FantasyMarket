# Fantasy Forecast League

Fantasy sports meets prediction markets. Compete with friends on real-world events using Polymarket data.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Getting Started](#getting-started)
- [How to Play](#how-to-play)
- [Scoring System](#scoring-system)
- [API Integration](#api-integration)
- [Deployment](#deployment)

## Overview

Fantasy Forecast League transforms prediction markets into season-long fantasy competitions. Instead of drafting athletes, 8-12 friends draft Polymarket markets and compete based on prediction accuracy.

## Features

- 🎯 Snake draft system for fair market selection
- 📊 Real-time market data from Polymarket Gamma API
- 💰 Secure prize pools using Solana PDAs
- 🔄 Mid-season trading system
- 🏆 Skill-based scoring with difficulty multipliers
- 🎖️ NFT achievement badges
- ⚡ Zero house rake - 100% payouts to players

## Tech Stack

**Blockchain:**
- Solana (Anchor Framework)
- Rust

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Solana Wallet Adapter

**Backend:**
- Next.js API Routes
- PostgreSQL
- Polymarket Gamma API

**Smart Contracts:**
- Anchor 0.28+
- SPL Token Program

## Architecture
```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Frontend  │─────▶│  API Server  │─────▶│ Solana Program  │
│  (Next.js)  │      │  (Next.js)   │      │    (Anchor)     │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Polymarket  │
                     │  Gamma API   │
                     └──────────────┘
```

### Data Flow

1. **Draft Phase**: Users select markets → Frontend calls API → Stores pick on-chain via Anchor
2. **Market Data**: Polymarket Gamma API → Backend caches → Frontend displays live odds
3. **Resolution**: Cron worker detects resolved markets → Calls on-chain scoring → Updates player points
4. **Payout**: Players claim → Smart contract calculates share → Transfers SOL/USDC from vault

## Smart Contracts

### Account Structure (PDAs)

**League**
- Seeds: `["league", league_id]`
- Stores: players, draft order, prize pool vault, session count

**PlayerState**
- Seeds: `["player_state", league_key, player_key]`
- Stores: points, streak, bonuses, claim status

**DraftPick**
- Seeds: `["draft_pick", league_key, player_key, session, pick_number]`
- Stores: market_id, prediction (YES/NO), snapshot_odds, resolved status, final_points

**TradeProposal**
- Seeds: `["trade", league_key, trade_id]`
- Stores: proposer, receiver, picks being swapped, status, expiration

### Key Instructions

- `create_league`: Initialize league and prize pool vault
- `join_league`: Transfer buy-in to vault, create PlayerState
- `start_draft`: Randomize draft order
- `make_pick`: Record draft selection with odds snapshot
- `resolve_market`: Calculate points with multipliers and bonuses
- `propose_trade`: Create trade offer between players
- `respond_to_trade`: Accept/reject and swap picks
- `claim_payout`: Distribute proportional winnings

## Getting Started

### Prerequisites

- Node.js 18+
- Rust & Solana CLI
- Anchor 0.28+
- PostgreSQL

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/fantasy-forecast-league
cd fantasy-forecast-league

# Install dependencies
npm install

# Build Solana program
cd programs/fantasy-forecast
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Set up environment variables
cp .env.example .env.local
# Add your program ID and RPC URL

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Environment Variables
```
NEXT_PUBLIC_PROGRAM_ID=<your-program-id>
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
DATABASE_URL=<postgresql-connection-string>
CRON_SECRET=<random-secure-string>
```

## How to Play

1. **Create a League**: Set buy-in amount, choose number of sessions
2. **Invite Friends**: Share league code (8-12 players)
3. **Draft Markets**: Snake draft Polymarket markets each week
4. **Lock Predictions**: Choose YES or NO for each market
5. **Track Progress**: Watch leaderboard update as markets resolve
6. **Claim Winnings**: Proportional payout based on total points

## Scoring System

### Base Points Formula
```
Points = 100 × (1 - p_pred) × Multiplier
```

Where `p_pred` is the probability of your prediction at draft time.

### Multipliers

| Probability Range | Category | Multiplier |
|-------------------|----------|------------|
| ≥ 70%            | Favorite | 1.0x       |
| 40-69%           | Balanced | 1.2x       |
| < 40%            | Long-shot| 1.5x       |

### Bonuses

- **Long-shot Bonus**: +10 points (p_pred < 20% AND correct)
- **Streak Bonus**: +25 points (every 5 consecutive correct)
- **Clean Sweep**: +50 points (5/5 correct in a session)

### Loss Points
```
Loss = -30 × p_pred
```

## API Integration

### Polymarket Gamma API

We use Polymarket's Gamma API for:

**During Draft:**
```javascript
GET https://gamma-api.polymarket.com/markets
// Returns available markets with current odds
```

**Market Details:**
```javascript
GET https://gamma-api.polymarket.com/markets/{marketId}
// Returns specific market data including resolution status
```

**Resolution Detection (Cron):**
```javascript
// Check every market for resolution
if (market.closed && market.resolvedAt) {
  // Trigger on-chain resolve_market instruction
}
```

### Cached Data

We cache the following in PostgreSQL:
- Market metadata (title, category, resolution criteria)
- Price history for live score calculations
- Resolution states

## Deployment

### Solana Program
```bash
anchor build
anchor deploy --provider.cluster mainnet-beta
```

### Frontend (Vercel)
```bash
vercel deploy --prod
```

### Cron Jobs

Set up in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/weekly",
    "schedule": "0 */6 * * *"
  }]
}
```

## Roadmap

- [ ] Mobile app (iOS/Android)
- [ ] Public leagues with ELO matchmaking
- [ ] Multi-outcome markets
- [ ] Cross-chain USDC via Circle CCTP
- [ ] DAO governance for rule changes
