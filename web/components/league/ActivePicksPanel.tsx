import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Pick {
    id: number;
    market: {
        title: string;
        currentPriceYes: number;
        currentPriceNo: number;
    };
    prediction: 'YES' | 'NO';
    snapshotOdds: number; // basis points
    points: number;
    isResolved: boolean;
    status: 'WINNING' | 'LOSING' | 'RESOLVED_WIN' | 'RESOLVED_LOSS';
}

interface SessionStats {
    picks: Pick[];
    session_points: number;
}

interface PlayerData {
    by_session: Record<string, SessionStats>;
    overall: {
        total_points: number;
        rank: number;
    };
}

export default function ActivePicksPanel({ leagueId, playerAddress }: { leagueId: string, playerAddress: string }) {
    const [data, setData] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/scores/player?league_id=${leagueId}&player=${playerAddress}`);
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error('Failed to fetch player picks:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [leagueId, playerAddress]);

    if (loading) return <div className="animate-pulse h-48 bg-gray-800 rounded-xl"></div>;
    if (!data || !data.by_session) return null;

    const sessions = Object.keys(data.by_session).sort((a, b) => Number(b) - Number(a)); // Newest first

    return (
        <Card className="bg-gray-800 border-gray-700 text-white">
            <CardHeader>
                <CardTitle>Your Picks</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue={sessions[0] || "1"}>
                    <TabsList className="bg-gray-900 mb-4">
                        {sessions.map(session => (
                            <TabsTrigger key={session} value={session}>
                                Session {session}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {sessions.map(session => {
                        const stats = data.by_session[session];
                        return (
                            <TabsContent key={session} value={session} className="space-y-4">
                                <div className="flex justify-between text-sm text-gray-400 mb-2">
                                    <span>Session Score: <span className="text-white font-bold">{stats.session_points.toFixed(1)}</span></span>
                                    <span>{stats.picks.length} Picks</span>
                                </div>

                                <div className="grid gap-3">
                                    {stats.picks.map(pick => {
                                        const isYes = pick.prediction === 'YES';
                                        const currentPrice = isYes
                                            ? pick.market.currentPriceYes
                                            : pick.market.currentPriceNo;
                                        const entryPrice = (pick.snapshotOdds || 5000) / 10000;
                                        const percentChange = ((currentPrice - entryPrice) / entryPrice) * 100;

                                        return (
                                            <div key={pick.id} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
                                                <div className="flex-1">
                                                    <p className="font-medium truncate pr-4">{pick.market.title}</p>
                                                    <div className="flex gap-2 mt-1 text-xs">
                                                        <Badge variant={isYes ? "default" : "destructive"}>
                                                            {pick.prediction}
                                                        </Badge>
                                                        <span className="text-gray-400">
                                                            Entry: {(entryPrice * 100).toFixed(0)}%
                                                        </span>
                                                        <span className="text-gray-400">
                                                            Current: {(currentPrice * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-bold text-lg ${pick.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {pick.points > 0 ? '+' : ''}{pick.points.toFixed(1)}
                                                    </p>
                                                    <p className={`text-xs ${percentChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {percentChange.toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </CardContent>
        </Card>
    );
}
