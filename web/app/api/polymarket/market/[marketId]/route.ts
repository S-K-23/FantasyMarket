import { NextRequest, NextResponse } from 'next/server';
import { getMarket } from '@/lib/polymarket';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ marketId: string }> }
) {
    const { marketId } = await params;

    try {
        const market = await getMarket(marketId);

        if (!market) {
            return NextResponse.json({ error: 'Market not found' }, { status: 404 });
        }

        // Extract prices
        let priceYes = 0;
        let priceNo = 0;

        if (market.outcomes && market.outcomePrices) {
            const yesIndex = market.outcomes.findIndex(o => o.toLowerCase() === 'yes');
            const noIndex = market.outcomes.findIndex(o => o.toLowerCase() === 'no');

            if (yesIndex !== -1) priceYes = parseFloat(market.outcomePrices[yesIndex] || '0');
            if (noIndex !== -1) priceNo = parseFloat(market.outcomePrices[noIndex] || '0');
        }

        // Get token IDs
        let tokenYes = '';
        let tokenNo = '';
        if (market.clobTokenIds && market.outcomes) {
            const yesIndex = market.outcomes.findIndex(o => o.toLowerCase() === 'yes');
            const noIndex = market.outcomes.findIndex(o => o.toLowerCase() === 'no');
            if (yesIndex !== -1) tokenYes = market.clobTokenIds[yesIndex];
            if (noIndex !== -1) tokenNo = market.clobTokenIds[noIndex];
        }

        return NextResponse.json({
            market_id: market.id,
            title: market.question,
            description: market.description || '',
            category: market.category || 'Uncategorized',
            end_date: market.endDate,
            current_price_yes: priceYes,
            current_price_no: priceNo,
            liquidity: market.liquidity || 0,
            volume: market.volume || 0,
            polymarket_url: market.slug
                ? `https://polymarket.com/event/${market.slug}`
                : `https://polymarket.com/event/${market.id}`,
            outcomes: ['YES', 'NO'],
            active: market.active,
            closed: market.closed,
            token_id_yes: tokenYes,
            token_id_no: tokenNo,
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch market' }, { status: 500 });
    }
}
