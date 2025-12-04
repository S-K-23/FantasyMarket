import { NextResponse } from 'next/server';
import { getMarkets } from '@/lib/polymarket';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const params: Record<string, any> = {};
    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    try {
        const markets = await getMarkets(params);
        return NextResponse.json(markets);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
    }
}
