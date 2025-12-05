import { NextRequest, NextResponse } from 'next/server';
import { getMarkets } from '@/lib/polymarket';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get('limit')) || 50;
    const category = searchParams.get('category') || undefined;
    const min_liquidity = Number(searchParams.get('min_liquidity')) || 100;

    try {
        // Fetch from Gamma API
        const markets = await getMarkets({
            limit: 100,
            active: true,
            closed: false,
            order: 'liquidity',
            ascending: false,
            category,
        });

        // Filter for valid binary markets with prices
        const filtered = markets.filter(m => {
            // Must have outcome prices
            if (!m.outcomePrices || m.outcomePrices.length < 2) {
                return false;
            }

            // Must have reasonable liquidity
            const liq = typeof m.liquidity === 'string' ? parseFloat(m.liquidity) : (m.liquidity || 0);
            if (liq < min_liquidity) {
                return false;
            }

            // Must have a future end date
            if (m.endDate && new Date(m.endDate) < new Date()) {
                return false;
            }

            return true;
        });

        // Slice for pagination
        const paged = filtered.slice(0, limit);

        // Transform to our API format
        const transformedMarkets = paged.map(m => {
            // Parse prices - outcomePrices may be a JSON string or array
            let priceYes = 0;
            let priceNo = 0;

            if (m.outcomePrices) {
                let prices: string[] = [];

                // Check if it's a string that needs parsing
                if (typeof m.outcomePrices === 'string') {
                    try {
                        prices = JSON.parse(m.outcomePrices);
                    } catch {
                        console.error('Failed to parse outcomePrices string');
                    }
                } else if (Array.isArray(m.outcomePrices)) {
                    prices = m.outcomePrices;
                }

                if (prices.length >= 2) {
                    priceYes = parseFloat(String(prices[0] || '0'));
                    priceNo = parseFloat(String(prices[1] || '0'));
                }
            }

            // Parse outcomes - may be a JSON string or array
            let outcomes: string[] = ['Yes', 'No'];
            if (m.outcomes) {
                if (typeof m.outcomes === 'string') {
                    try {
                        outcomes = JSON.parse(m.outcomes);
                    } catch {
                        outcomes = ['Yes', 'No'];
                    }
                } else if (Array.isArray(m.outcomes)) {
                    outcomes = m.outcomes;
                }
            }

            // Parse clobTokenIds - may be a JSON string or array
            let tokenYes = '';
            let tokenNo = '';
            if (m.clobTokenIds) {
                let tokens: string[] = [];
                if (typeof m.clobTokenIds === 'string') {
                    try {
                        tokens = JSON.parse(m.clobTokenIds);
                    } catch {
                        tokens = [];
                    }
                } else if (Array.isArray(m.clobTokenIds)) {
                    tokens = m.clobTokenIds;
                }
                tokenYes = tokens[0] || '';
                tokenNo = tokens[1] || '';
            }

            return {
                market_id: m.id,
                title: m.question,
                description: m.description || '',
                category: m.category || 'Uncategorized',
                end_date: m.endDate,
                current_price_yes: priceYes,
                current_price_no: priceNo,
                liquidity: typeof m.liquidity === 'string' ? parseFloat(m.liquidity) : (m.liquidity || 0),
                volume: typeof m.volume === 'string' ? parseFloat(m.volume) : (m.volume || 0),
                polymarket_url: m.slug ? `https://polymarket.com/event/${m.slug}` : `https://polymarket.com/event/${m.id}`,
                outcomes,
                active: m.active,
                token_id_yes: tokenYes,
                token_id_no: tokenNo,
            };
        });

        return NextResponse.json(transformedMarkets);

    } catch (error) {
        console.error('Error fetching markets:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
