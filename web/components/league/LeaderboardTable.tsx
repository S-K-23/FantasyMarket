'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LeaderboardPlayer {
    rank: number;
    player_address: string;
    total_score: number;
    live_score: number;
    final_score: number;
    streak: number;
    prize_share: number;
    change_24h: number;
    wins: number;
    losses: number;
    pending: number;
}

interface LeaderboardTableProps {
    players: LeaderboardPlayer[];
    currentPlayerAddress?: string;
}

export default function LeaderboardTable({ players, currentPlayerAddress }: LeaderboardTableProps) {
    const getRankIcon = (change: number) => {
        if (change > 0) return <TrendingUp className="text-green-500 w-4 h-4" />;
        if (change < 0) return <TrendingDown className="text-red-500 w-4 h-4" />;
        return <Minus className="text-gray-400 w-4 h-4" />;
    };

    return (
        <div className="bg-gray-800 rounded-xl overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="border-gray-700">
                        <TableHead className="text-gray-300">Rank</TableHead>
                        <TableHead className="text-gray-300">Player</TableHead>
                        <TableHead className="text-right text-gray-300">Total Score</TableHead>
                        <TableHead className="text-right text-gray-300">Live Score</TableHead>
                        <TableHead className="text-center text-gray-300">Streak</TableHead>
                        <TableHead className="text-center text-gray-300">Record</TableHead>
                        <TableHead className="text-right text-gray-300">Prize Share</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {players?.map((player) => {
                        const isCurrentPlayer = player.player_address === currentPlayerAddress;

                        return (
                            <TableRow
                                key={player.player_address}
                                className={`border-gray-700 ${isCurrentPlayer ? 'bg-blue-900/30' : 'hover:bg-gray-700/50'}`}
                            >
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-lg ${player.rank === 1 ? 'text-yellow-400' :
                                                player.rank === 2 ? 'text-gray-300' :
                                                    player.rank === 3 ? 'text-orange-400' :
                                                        'text-white'
                                            }`}>
                                            #{player.rank}
                                        </span>
                                        {getRankIcon(player.change_24h)}
                                    </div>
                                </TableCell>

                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full ${player.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                                                player.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                                                    player.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-red-500' :
                                                        'bg-gradient-to-br from-purple-400 to-pink-600'
                                            }`} />
                                        <div>
                                            <span className="font-medium text-white">
                                                {player.player_address.slice(0, 6)}...{player.player_address.slice(-4)}
                                            </span>
                                            {isCurrentPlayer && (
                                                <Badge variant="secondary" className="ml-2 text-xs">You</Badge>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell className="text-right">
                                    <div>
                                        <p className="font-bold text-lg text-white">{player.total_score.toFixed(1)}</p>
                                        <p className="text-xs text-gray-400">
                                            {player.final_score.toFixed(0)} locked
                                        </p>
                                    </div>
                                </TableCell>

                                <TableCell className="text-right">
                                    <Badge
                                        variant={player.live_score >= 0 ? 'default' : 'destructive'}
                                        className="font-mono"
                                    >
                                        {player.live_score >= 0 ? '+' : ''}{player.live_score.toFixed(1)}
                                    </Badge>
                                </TableCell>

                                <TableCell className="text-center">
                                    {player.streak > 0 ? (
                                        <span className="text-orange-500 font-bold">
                                            🔥 {player.streak}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">—</span>
                                    )}
                                </TableCell>

                                <TableCell className="text-center">
                                    <span className="font-mono text-sm text-white">
                                        <span className="text-green-400">{player.wins}</span>
                                        -
                                        <span className="text-red-400">{player.losses}</span>
                                        {player.pending > 0 && (
                                            <span className="text-gray-400"> ({player.pending})</span>
                                        )}
                                    </span>
                                </TableCell>

                                <TableCell className="text-right">
                                    <div className="space-y-1">
                                        <p className="font-bold text-white">{(player.prize_share * 100).toFixed(2)}%</p>
                                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                                                style={{ width: `${player.prize_share * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
