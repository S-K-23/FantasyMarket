'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface Player {
    address: string;
    points: number;
}

interface LobbyAnalyticsProps {
    players: Player[];
    prizePool: number;
    currency: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function LobbyAnalytics({ players, prizePool, currency }: LobbyAnalyticsProps) {
    // Data for Prize Distribution (Projected)
    const prizeData = [
        { name: '1st Place', value: prizePool * 0.5 },
        { name: '2nd Place', value: prizePool * 0.3 },
        { name: '3rd Place', value: prizePool * 0.2 },
    ];

    // Data for Player Points
    const pointsData = players.map(p => ({
        name: p.address.slice(0, 4),
        points: p.points
    })).sort((a, b) => b.points - a.points);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Prize Pool Distribution */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4 text-center">💰 Prize Pool Distribution</h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={prizeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {prizeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                formatter={(value: number) => [`${value.toFixed(2)} ${currency}`, 'Prize']}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Performers */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4 text-center">📊 Top Performers</h3>
                {players.length > 0 ? (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pointsData}>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                                <YAxis stroke="#9ca3af" fontSize={12} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                />
                                <Bar dataKey="points" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500">
                        No player data yet
                    </div>
                )}
            </div>
        </div>
    );
}
