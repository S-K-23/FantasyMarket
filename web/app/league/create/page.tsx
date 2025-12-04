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
        category: 'All Categories'
    });

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
                })
            });

            if (!response.ok) throw new Error('Failed to create league');

            const league = await response.json();
            router.push(`/league/${league.id}/lobby`);
        } catch (error) {
            console.error('Error creating league:', error);
            alert('Failed to create league. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted">
            <nav className="border-b">
                <div className="container mx-auto px-4 py-4">
                    <Link href="/" className="text-xl font-bold">← Back to Home</Link>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-12 max-w-2xl">
                <h1 className="text-4xl font-bold mb-8">Create a League</h1>

                <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-lg border">
                    <div>
                        <label className="block text-sm font-medium mb-2">League Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border rounded-md bg-background"
                            placeholder="My Fantasy League"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Market Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-2 border rounded-md bg-background"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
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
                                className="w-full px-4 py-2 border rounded-md bg-background"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Currency</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-4 py-2 border rounded-md bg-background"
                            >
                                <option value="SOL">SOL</option>
                                <option value="USDC">USDC</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Max Players (2-12)</label>
                        <input
                            type="number"
                            min="2"
                            max="12"
                            required
                            value={formData.maxPlayers}
                            onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })}
                            className="w-full px-4 py-2 border rounded-md bg-background"
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
                            className="w-full px-4 py-2 border rounded-md bg-background"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Markets per Session</label>
                        <input
                            type="number"
                            min="3"
                            max="10"
                            required
                            value={formData.marketsPerSession}
                            onChange={(e) => setFormData({ ...formData, marketsPerSession: e.target.value })}
                            className="w-full px-4 py-2 border rounded-md bg-background"
                        />
                    </div>

                    <div className="bg-muted p-4 rounded-md">
                        <p className="text-sm text-muted-foreground">
                            <strong>Estimated Prize Pool:</strong> {parseFloat(formData.buyIn) * parseInt(formData.maxPlayers)} {formData.currency}
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !connected}
                        className="w-full h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : connected ? 'Create League' : 'Connect Wallet First'}
                    </button>
                </form>
            </div>
        </div>
    );
}
