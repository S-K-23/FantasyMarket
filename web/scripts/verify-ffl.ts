// import fetch from 'node-fetch'; // Use native fetch

const BASE_URL = 'http://localhost:3000';

async function verify() {
    console.log('Starting Full Verification...');

    // 1. Create League
    console.log('\n1. Creating League...');
    const leagueId = `league_${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/leagues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            leagueId,
            name: 'Test League',
            creator: 'TestCreatorPublicKey',
            buyIn: '0.1',
            currency: 'SOL',
            maxPlayers: '8',
            totalSessions: '8',
            marketsPerSession: '5'
        })
    });
    const league = await createRes.json();
    console.log('Create Status:', createRes.status);
    console.log('League ID:', league.id);

    if (!league.id) {
        console.error('Failed to create league, aborting.');
        return;
    }

    // 2. Verify League Join API
    console.log('\n2. Testing /api/league/join...');
    const joinRes = await fetch(`${BASE_URL}/api/league/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            leagueId: leagueId, // Use the string ID
            player: 'Player2PublicKey',
            signature: 'mock_signature_join'
        })
    });
    console.log('Join Status:', joinRes.status);
    const joinData = await joinRes.json();
    console.log('Join Data:', joinData);

    // 3. Verify Draft Pick API
    console.log('\n3. Testing /api/draft/pick...');
    const pickRes = await fetch(`${BASE_URL}/api/draft/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            leagueId: leagueId,
            marketId: '0x1234567890abcdef', // Mock Market ID
            player: 'Player2PublicKey',
            prediction: 'YES',
            session: 1,
            pickIndex: 0,
            snapshotOdds: 5000
        })
    });
    console.log('Pick Status:', pickRes.status);
    const pickData = await pickRes.json();
    console.log('Pick Data:', pickData);

    // 4. Verify Resolution Cron
    console.log('\n4. Testing /api/cron/resolve...');
    const resolveRes = await fetch(`${BASE_URL}/api/cron/resolve`);
    console.log('Resolve Status:', resolveRes.status);
    const resolveData = await resolveRes.json();
    console.log('Resolve Data:', resolveData);

    console.log('\nVerification Complete.');
}

verify().catch(console.error);
