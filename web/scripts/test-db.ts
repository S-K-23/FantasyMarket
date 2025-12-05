import { PrismaClient } from '../lib/generated/client/client';

const prisma = new PrismaClient({});

async function main() {
    try {
        console.log('Connecting to database...');
        const count = await prisma.league.count();
        console.log(`Found ${count} existing leagues.`);

        console.log('Creating test league...');
        const leagueId = `test_league_${Date.now()}`;
        const league = await prisma.league.create({
            data: {
                leagueId: leagueId,
                name: 'Automated Test League',
                creator: 'TestCreatorWallet',
                buyIn: 0.1,
                currency: 'SOL',
                maxPlayers: 4,
                totalSessions: 2,
                marketsPerSession: 5,
                status: 'DRAFTING', // Set to DRAFTING to test dashboard immediately
                category: 'Sports'
            }
        });

        console.log(`Created league with ID: ${league.id} (leagueId: ${league.leagueId})`);

        // Create a dummy player
        await prisma.playerStats.create({
            data: {
                leagueId: league.id,
                address: 'TestCreatorWallet',
                points: 100,
                streak: 2
            }
        });
        console.log('Created dummy player.');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
