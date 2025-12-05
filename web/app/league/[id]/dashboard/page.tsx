import { useParams } from 'next/navigation';
import TradeInterface from '@/components/TradeInterface';
import ClaimPayoutButton from '@/components/ClaimPayoutButton';
import { useState, useEffect } from 'react';

export default function LeagueDashboard() {
    const params = useParams();
    const leagueId = Number(params.id);
    const [league, setLeague] = useState<any>(null);
    const [playerState, setPlayerState] = useState<any>(null);

    useEffect(() => {
        if (leagueId) {
            fetch(`/api/leagues?id=${leagueId}`)
                .then(res => res.json())
                .then(data => setLeague(Array.isArray(data) ? data[0] : data));

            // Fetch player state? Need an endpoint or just pass props if we had them.
            // For now, let's assume we can get hasClaimed from somewhere or let the button handle it (it doesn't check DB, it checks on-chain state if we updated it to do so, but the button component I wrote checks `hasClaimed` prop).
            // Actually, the button component I wrote takes `hasClaimed` as a prop.
            // I should fetch it.
        }
    }, [leagueId]);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="container mx-auto">
                <h1 className="text-3xl font-bold mb-6">League Dashboard</h1>

                {league && (
                    <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-semibold">{league.name}</h2>
                            <p className="text-gray-400">Status: {league.status}</p>
                        </div>
                        <div>
                            <ClaimPayoutButton
                                leagueId={leagueId}
                                isSeasonEnded={league.status === 'COMPLETED'}
                                hasClaimed={false} // TODO: Fetch this from DB/Chain
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">My Team</h2>
                        {/* Team view would go here */}
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                            <p className="text-gray-400">Team stats and roster coming soon...</p>
                        </div>
                    </div>

                    <div>
                        <TradeInterface leagueId={leagueId} />
                    </div>
                </div>
            </div>
        </div>
    );
}
