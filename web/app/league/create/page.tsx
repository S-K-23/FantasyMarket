'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';

const CATEGORIES = [
    'All Categories',
    'Sports',
    'Politics',
    'Crypto',
    'Pop Culture',
    'Business',
    'Science',
];

export default function CreateLeague() {
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        buyIn: '0.1',
        currency: 'SOL',
        maxPlayers: '8',
        totalSessions: '8',
        marketsPerSession: '5',
        category: 'All Categories',
        leagueType: 'STANDARD' as 'STANDARD' | 'ONE_ON_ONE'
    });

    // Auto-configure for 1v1 mode
    useEffect(() => {
        if (formData.leagueType === 'ONE_ON_ONE') {
            setFormData(prev => ({
                ...prev,
                maxPlayers: '2',
                totalSessions: '1'
            }));
        }
    }, [formData.leagueType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!connected || !publicKey) {
            alert('Please connect your wallet');
            return;
        }

        setLoading(true);
        try {
            // Generate a unique league ID (in production, this would be from on-chain)
            const leagueId = `league_${Date.now()}`;

            // Create league in database
            const response = await fetch('/api/leagues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId,
                    name: formData.name,
                    creator: publicKey.toString(),
                    buyIn: formData.buyIn,
                    currency: formData.currency,
                    maxPlayers: formData.maxPlayers,
                    totalSessions: formData.totalSessions,
                    marketsPerSession: formData.marketsPerSession,
                    category: formData.category === 'All Categories' ? null : formData.category,
                    leagueType: formData.leagueType,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Failed to create league');
            }

            const league = await response.json();
            router.push(`/league/${league.id}/lobby`);
        } catch (error: any) {
            console.error('Error creating league:', error);
            alert(`Failed to create league: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const is1v1 = formData.leagueType === 'ONE_ON_ONE';

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
                <div className="container mx-auto px-4 py-4">
                    <Link href="/" className="text-xl font-bold hover:text-blue-400">← Back to Home</Link>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-12 max-w-2xl">
                <h1 className="text-4xl font-bold mb-8">Create a League</h1>

                <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 p-8 rounded-xl border border-gray-700">
                    {/* League Type Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-3">League Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, leagueType: 'STANDARD' })}
                                className={`p-4 rounded-lg border-2 transition-all ${formData.leagueType === 'STANDARD'
                                    ? 'border-blue-500 bg-blue-500/20'
                                    : 'border-gray-600 hover:border-gray-500'
                                    }`}
                            >
                                <div className="text-lg font-bold mb-1">🏆 Standard</div>
                                <div className="text-xs text-gray-400">2-12 players, multi-session fantasy league</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, leagueType: 'ONE_ON_ONE' })}
                                className={`p-4 rounded-lg border-2 transition-all ${formData.leagueType === 'ONE_ON_ONE'
                                    ? 'border-purple-500 bg-purple-500/20'
                                    : 'border-gray-600 hover:border-gray-500'
                                    }`}
                            >
                                <div className="text-lg font-bold mb-1">⚔️ 1v1 Duel</div>
                                <div className="text-xs text-gray-400">Head-to-head, ELO ranked</div>
                            </button>
                        </div>
                    </div>

                    {is1v1 && (
                        <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-4">
                            <h4 className="font-semibold text-purple-300 mb-2">⚔️ 1v1 Duel Mode</h4>
                            <ul className="text-sm text-gray-300 space-y-1">
                                <li>• 2 players compete head-to-head</li>
                                <li>• Simulated Polymarket positions</li>
                                <li>• Winner gains +100 ELO, loser -100 ELO</li>
                                <li>• Winner takes the prize pool</li>
                            </ul>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-2">League Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={is1v1 ? "1v1 Challenge" : "My Fantasy League"}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Market Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:border-blue-500 focus:outline-none"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                            Restrict draft markets to a specific category (or allow all categories)
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Buy-in Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={formData.buyIn}
                                onChange={(e) => setFormData({ ...formData, buyIn: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Currency</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:border-blue-500 focus:outline-none"
                            >
                                <option value="SOL">SOL</option>
                                <option value="USDC">USDC</option>
                            </select>
                        </div>
                    </div>

                    {!is1v1 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-2">Max Players (2-12)</label>
                                <input
                                    type="number"
                                    min="2"
                                    max="12"
                                    required
                                    value={formData.maxPlayers}
                                    onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Number of Sessions</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="16"
                                    required
                                    value={formData.totalSessions}
                                    onChange={(e) => setFormData({ ...formData, totalSessions: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-2">Markets per Session</label>
                        <input
                            type="number"
                            min="3"
                            max="10"
                            required
                            value={formData.marketsPerSession}
                            onChange={(e) => setFormData({ ...formData, marketsPerSession: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div className="bg-gray-700/50 p-4 rounded-md">
                        <p className="text-sm text-gray-300">
                            <strong>Prize Pool:</strong> {parseFloat(formData.buyIn) * parseInt(formData.maxPlayers)} {formData.currency}
                            {is1v1 && <span className="text-purple-400 ml-2">(Winner takes all)</span>}
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !connected}
                        className={`w-full h-11 items-center justify-center rounded-md px-8 text-sm font-medium text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${is1v1
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
                            }`}
                    >
                        {loading ? 'Creating...' : connected ? (is1v1 ? 'Create 1v1 Duel' : 'Create League') : 'Connect Wallet First'}
                    </button>
                </form>
            </div>
        </div>
    );
}
