import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMarket } from '@/lib/polymarket';

export async function POST() {
    try {
        // 1. Get all active markets from DB
        const activeMarkets = await prisma.market.findMany({
            where: {
                active: true,
                // Optional: only update markets that haven't been updated in X minutes
                // updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } 
            }
        });

        if (activeMarkets.length === 0) {
            return NextResponse.json({ message: 'No active markets to update' });
        }

        console.log(`Updating prices for ${activeMarkets.length} markets...`);

        let updatedCount = 0;
        let errors = 0;

        // 2. Fetch latest data for each market
        // Using Promise.all with map for concurrency
        await Promise.all(activeMarkets.map(async (dbMarket) => {
            try {
                const marketData = await getMarket(dbMarket.id);

                if (marketData) {
                    // Extract prices
                    // outcomePrices is ["0.65", "0.35"] for ["Yes", "No"]
                    // But sometimes outcomes are different, assuming Yes/No for now as per MVP
                    let priceYes = 0;
                    let priceNo = 0;

                    if (marketData.outcomePrices) {
                        // Polymarket usually returns strings
                        priceYes = parseFloat(marketData.outcomePrices[0] || '0');
                        priceNo = parseFloat(marketData.outcomePrices[1] || '0');
                    }

                    // 3. Update DB
                    await prisma.market.update({
                        where: { id: dbMarket.id },
                        data: {
                            currentPriceYes: priceYes,
                            currentPriceNo: priceNo,
                            // Check if resolved?
                            // If marketData.closed is true, we might want to trigger resolution
                            // But let's keep it simple for now and just update prices
                        }
                    });
                    updatedCount++;
                }
            } catch (err) {
                console.error(`Failed to update market ${dbMarket.id}:`, err);
                errors++;
            }
        }));

        return NextResponse.json({
            success: true,
            total: activeMarkets.length,
            updated: updatedCount,
            errors
        });

    } catch (error) {
        console.error('Price update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
