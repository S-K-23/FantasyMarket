import { NextRequest, NextResponse } from 'next/server';
import { getMarkets } from '@/lib/polymarket';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const min_liquidity = Number(searchParams.get('min_liquidity')) || 100;
    const limit = Number(searchParams.get('limit')) || 50;

    try {
        // Fetch from Gamma API directly
        const markets = await getMarkets({
            limit: 100,
            active: true,
            closed: false,
            order: 'liquidity',
            ascending: false,
        });

        console.log(`Fetched ${markets.length} raw markets from Polymarket`);

        // Filter for valid binary markets with prices
        const filtered = markets.filter(m => {
            // Must have outcome prices
            if (!m.outcomePrices || m.outcomePrices.length < 2) {
                return false;
            }

            // Must have reasonable liquidity
            if ((m.liquidity || 0) < min_liquidity) {
                return false;
            }

            // Must have a future end date
            if (m.endDate && new Date(m.endDate) < new Date()) {
                return false;
            }

            return true;
        });

        console.log(`Filtered to ${filtered.length} valid markets`);

        // Slice for pagination
        const paged = filtered.slice(0, limit);

        // Transform to our API format
        const transformedMarkets = paged.map(m => {
            // Parse prices - Polymarket typically has [Yes, No] order
            const priceYes = parseFloat(m.outcomePrices[0] || '0');
            const priceNo = parseFloat(m.outcomePrices[1] || '0');

            // Get token IDs
            const tokenYes = m.clobTokenIds?.[0] || '';
            const tokenNo = m.clobTokenIds?.[1] || '';

            return {
                market_id: m.id,
                title: m.question,
                description: m.description || '',
                category: m.category || 'Uncategorized',
                end_date: m.endDate,
                current_price_yes: priceYes,
                current_price_no: priceNo,
                liquidity: m.liquidity || 0,
                volume: m.volume || 0,
                polymarket_url: m.slug ? `https://polymarket.com/event/${m.slug}` : `https://polymarket.com/event/${m.id}`,
                outcomes: m.outcomes || ['Yes', 'No'],
                active: m.active,
                token_id_yes: tokenYes,
                token_id_no: tokenNo,
            };
        });

        return NextResponse.json({
            markets: transformedMarkets,
            total: filtered.length,
            hasMore: filtered.length > limit
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
    }
}
