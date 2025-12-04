import { NextResponse } from 'next/server';
import { getMarkets } from '@/lib/polymarket';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') || '50';
        const active = searchParams.get('active') !== 'false';
        const closed = searchParams.get('closed') === 'true';

        const markets = await getMarkets({
            limit,
            active,
            closed
        });

        return NextResponse.json(markets);
    } catch (error) {
        console.error('Error fetching markets:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
