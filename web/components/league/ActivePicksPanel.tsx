'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PickDetail {
    session_index: number;
    market_id: string;
    market_title: string;
    prediction: 'YES' | 'NO';
    snapshot_odds: number;
    current_odds: number;
    status: 'open' | 'resolved';
    resolution: string | null;
    points: number;
}

interface PlayerScoreData {
    player_address: string;
    league_id: number;
    overall: {
        total_points: number;
        final_points: number;
        live_points: number;
        rank: number;
        streak: number;
        prize_share: number;
    };
    by_session: Array<{
        session_index: number;
        points: number;
        picks_correct: number;
        picks_total: number;
        had_clean_sweep: boolean;
    }>;
    bonuses: {
        streak_bonus: number;
        longshot_bonus: number;
        clean_sweep_bonus: number;
        total: number;
    };
    all_picks: PickDetail[];
}

export default function ActivePicksPanel({ leagueId, playerAddress }: { leagueId: string, playerAddress: string }) {
    const [data, setData] = useState<PlayerScoreData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/scores/player?league_id=${leagueId}&player_address=${playerAddress}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error('Failed to fetch player picks:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 15000); // Update every 15 seconds
        return () => clearInterval(interval);
    }, [leagueId, playerAddress]);

    if (loading) return <div className="animate-pulse h-48 bg-gray-800 rounded-xl"></div>;
    if (!data || !data.all_picks || data.all_picks.length === 0) {
        return (
            <Card className="bg-gray-800 border-gray-700 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        📊 Your Picks
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-400 text-center py-8">
                        No picks yet. Head to the draft room to make your predictions!
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Group picks by session
    const picksBySession = new Map<number, PickDetail[]>();
    for (const pick of data.all_picks) {
        if (!picksBySession.has(pick.session_index)) {
            picksBySession.set(pick.session_index, []);
        }
        picksBySession.get(pick.session_index)!.push(pick);
    }

    const sessions = Array.from(picksBySession.keys()).sort((a, b) => b - a);

    return (
        <Card className="bg-gray-800 border-gray-700 text-white">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        📊 Your Picks
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                            <span className="text-gray-400">Live Score</span>
                            <p className={`font-bold text-lg ${data.overall.live_points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {data.overall.live_points >= 0 ? '+' : ''}{data.overall.live_points.toFixed(1)}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-gray-400">Total</span>
                            <p className="font-bold text-lg text-white">
                                {data.overall.total_points.toFixed(1)}
                            </p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {sessions.map(sessionIndex => {
                    const picks = picksBySession.get(sessionIndex)!;
                    const sessionStats = data.by_session.find(s => s.session_index === sessionIndex);
                    const sessionPoints = sessionStats?.points || picks.reduce((sum, p) => sum + p.points, 0);

                    return (
                        <div key={sessionIndex} className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 font-medium">Session {sessionIndex}</span>
                                <span className={`font-bold ${sessionPoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {sessionPoints >= 0 ? '+' : ''}{sessionPoints.toFixed(1)} pts
                                </span>
                            </div>

                            <div className="grid gap-2">
                                {picks.map((pick, idx) => {
                                    const isYes = pick.prediction === 'YES';
                                    const entryOdds = (pick.snapshot_odds * 100).toFixed(0);
                                    const currentOdds = (pick.current_odds * 100).toFixed(0);
                                    const isWinning = pick.points > 0;
                                    const isResolved = pick.status === 'resolved';

                                    return (
                                        <div
                                            key={`${pick.market_id}-${idx}`}
                                            className={`p-3 rounded-lg border ${isResolved
                                                    ? isWinning
                                                        ? 'bg-green-900/20 border-green-600/30'
                                                        : 'bg-red-900/20 border-red-600/30'
                                                    : 'bg-gray-900 border-gray-700'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate" title={pick.market_title}>
                                                        {pick.market_title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge
                                                            variant={isYes ? "default" : "destructive"}
                                                            className="text-xs"
                                                        >
                                                            {pick.prediction}
                                                        </Badge>
                                                        <span className="text-xs text-gray-500">
                                                            {entryOdds}% → {currentOdds}%
                                                        </span>
                                                        {isResolved && (
                                                            <Badge variant="outline" className="text-xs border-gray-600">
                                                                {pick.resolution === pick.prediction ? '✅ Won' : '❌ Lost'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className={`font-bold ${pick.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {pick.points >= 0 ? '+' : ''}{pick.points.toFixed(1)}
                                                    </p>
                                                    {!isResolved && (
                                                        <p className="text-xs text-gray-500">live</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Bonuses Section */}
                {(data.bonuses.streak_bonus > 0 || data.bonuses.clean_sweep_bonus > 0 || data.bonuses.longshot_bonus > 0) && (
                    <div className="border-t border-gray-700 pt-4">
                        <p className="text-sm text-gray-400 mb-2">Bonuses</p>
                        <div className="flex flex-wrap gap-2">
                            {data.bonuses.streak_bonus > 0 && (
                                <Badge variant="secondary" className="bg-orange-600/20 text-orange-400">
                                    🔥 Streak +{data.bonuses.streak_bonus}
                                </Badge>
                            )}
                            {data.bonuses.clean_sweep_bonus > 0 && (
                                <Badge variant="secondary" className="bg-purple-600/20 text-purple-400">
                                    ✨ Clean Sweep +{data.bonuses.clean_sweep_bonus}
                                </Badge>
                            )}
                            {data.bonuses.longshot_bonus > 0 && (
                                <Badge variant="secondary" className="bg-blue-600/20 text-blue-400">
                                    🎯 Long-shot +{data.bonuses.longshot_bonus}
                                </Badge>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
