import { getMarkets } from '../lib/polymarket.ts';
import { prisma } from '../lib/prisma.ts';

async function syncPolymarketMarkets() {
  try {
    console.log('Fetching active markets from Polymarket...');
    const polymarketMarkets = await getMarkets({ active: true, closed: false, limit: 100 }); // Fetch up to 100 active markets

    if (polymarketMarkets.length === 0) {
      console.log('No active markets found on Polymarket.');
      return;
    }

    console.log(`Found ${polymarketMarkets.length} active markets. Syncing with database...`);

    for (const pmMarket of polymarketMarkets) {
      let p0 = 0.5; // Default to 0.5
      if (pmMarket.tokens && pmMarket.tokens.length > 0) {
        const yesToken = pmMarket.tokens.find(token => token.outcome === 'Yes');
        if (yesToken) {
          p0 = yesToken.price;
        }
      }

      await prisma.market.upsert({
        where: { id: pmMarket.id },
        update: {
          title: pmMarket.question,
          category: (pmMarket.tags && pmMarket.tags.length > 0) ? pmMarket.tags[0].label : 'Uncategorized', // Use first tag as category
          p0: p0,
          resolution: pmMarket.closed ? (pmMarket.tokens && pmMarket.tokens.find(t => t.winner)?.outcome || null) : null,
          resolvedAt: pmMarket.closed ? (pmMarket.resolutionDate ? new Date(pmMarket.resolutionDate) : null) : null,
        },
        create: {
          id: pmMarket.id,
          title: pmMarket.question,
          category: (pmMarket.tags && pmMarket.tags.length > 0) ? pmMarket.tags[0].label : 'Uncategorized',
          p0: p0,
          resolution: pmMarket.closed ? (pmMarket.tokens && pmMarket.tokens.find(t => t.winner)?.outcome || null) : null,
          resolvedAt: pmMarket.closed ? (pmMarket.resolutionDate ? new Date(pmMarket.resolutionDate) : null) : null,
        },
      });
    }

    console.log('Polymarket markets synced successfully!');
  } catch (error) {
    console.error('Error syncing Polymarket markets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncPolymarketMarkets();
