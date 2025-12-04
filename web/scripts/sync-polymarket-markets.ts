import { getMarkets } from '../lib/polymarket';
import { prisma } from '../lib/prisma';

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
      // Determine p0 based on the "Yes" outcome token price
      const yesToken = pmMarket.tokens.find(token => token.outcome === 'Yes');
      const p0 = yesToken ? yesToken.price : 0.5; // Default to 0.5 if "Yes" token not found

      await prisma.market.upsert({
        where: { id: pmMarket.id },
        update: {
          title: pmMarket.question,
          category: pmMarket.tags[0]?.label || 'Uncategorized', // Use first tag as category
          p0: p0,
          resolution: pmMarket.closed ? (pmMarket.tokens.find(t => t.winner)?.outcome || null) : null,
          resolvedAt: pmMarket.closed ? new Date(pmMarket.resolutionDate) : null,
        },
        create: {
          id: pmMarket.id,
          title: pmMarket.question,
          category: pmMarket.tags[0]?.label || 'Uncategorized',
          p0: p0,
          resolution: pmMarket.closed ? (pmMarket.tokens.find(t => t.winner)?.outcome || null) : null,
          resolvedAt: pmMarket.closed ? new Date(pmMarket.resolutionDate) : null,
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
