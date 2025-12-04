'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/ui/wallet-button';

interface PlayerLeague {
  id: number;
  leagueId: string;
  name: string;
  status: string;
  buyIn: number;
  currency: string;
  currentSession: number;
  totalSessions: number;
  _count: { players: number; draftPicks: number };
  playerStats: {
    points: number;
    streak: number;
    rank: number | null;
  };
  myPicks: Array<{
    id: number;
    marketId: string;
    prediction: string;
    snapshotOdds: number | null;
  }>;
}

export default function Home() {
  const { publicKey, connected } = useWallet();
  const [myLeagues, setMyLeagues] = useState<PlayerLeague[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      setLoading(true);
      fetch(`/api/player/leagues?player=${publicKey.toBase58()}`)
        .then(res => res.json())
        .then(data => {
          setMyLeagues(data.leagues || []);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch leagues:', err);
          setLoading(false);
        });
    } else {
      setMyLeagues([]);
    }
  }, [connected, publicKey]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SETUP':
        return <span className="px-2 py-1 rounded-full text-xs bg-yellow-600/20 text-yellow-400">Waiting</span>;
      case 'DRAFTING':
        return <span className="px-2 py-1 rounded-full text-xs bg-blue-600/20 text-blue-400">Drafting</span>;
      case 'ACTIVE':
        return <span className="px-2 py-1 rounded-full text-xs bg-green-600/20 text-green-400">Active</span>;
      case 'COMPLETED':
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-600/20 text-gray-400">Completed</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-600/20 text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Fantasy Forecast League
          </h1>
          <WalletButton />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Fantasy Forecast League
        </h2>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          Season-long leagues built on prediction markets. Draft real-world events, earn points based on correctness and difficulty, win proportional payouts.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/league/create"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 text-sm font-medium shadow-lg hover:from-blue-500 hover:to-purple-500 transition-all"
          >
            🚀 Create a League
          </Link>
          <Link
            href="/leagues"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-gray-600 bg-gray-800/50 px-8 text-sm font-medium hover:bg-gray-700 transition-all"
          >
            Browse Leagues
          </Link>
        </div>
      </section>

      {/* Your Leagues Section (only when connected) */}
      {connected && (
        <section className="container mx-auto px-4 py-8">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
            📋 Your Leagues
            {loading && <span className="text-sm text-gray-400 font-normal">Loading...</span>}
          </h3>

          {myLeagues.length === 0 && !loading ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
              <p className="text-gray-400 mb-4">You haven't joined any leagues yet.</p>
              <Link
                href="/leagues"
                className="text-blue-400 hover:underline"
              >
                Browse available leagues →
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myLeagues.map(league => (
                <Link
                  key={league.id}
                  href={`/league/${league.id}/${league.status === 'SETUP' || league.status === 'DRAFTING' ? 'lobby' : 'draft'}`}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-all group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-lg group-hover:text-blue-400 transition">{league.name}</h4>
                    {getStatusBadge(league.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="bg-gray-700/50 p-2 rounded">
                      <div className="text-gray-400 text-xs">Your Points</div>
                      <div className="font-bold text-lg">{league.playerStats.points.toFixed(0)}</div>
                    </div>
                    <div className="bg-gray-700/50 p-2 rounded">
                      <div className="text-gray-400 text-xs">Streak</div>
                      <div className="font-bold text-lg">🔥 {league.playerStats.streak}</div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{league._count.players} players</span>
                    <span>Session {league.currentSession}/{league.totalSessions}</span>
                    <span>{league.myPicks.length} picks</span>
                  </div>

                  {league.myPicks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-xs text-gray-400 mb-2">Recent Picks:</div>
                      <div className="flex flex-wrap gap-1">
                        {league.myPicks.slice(0, 5).map(pick => (
                          <span
                            key={pick.id}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${pick.prediction === 'YES' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
                              }`}
                          >
                            {pick.prediction}
                          </span>
                        ))}
                        {league.myPicks.length > 5 && (
                          <span className="text-xs text-gray-500">+{league.myPicks.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl">
            <div className="text-4xl mb-4">📊</div>
            <h4 className="text-xl font-semibold mb-2">Draft Markets, Not Players</h4>
            <p className="text-gray-400">
              Snake draft prediction markets from Polymarket. Choose YES or NO on real-world events.
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl">
            <div className="text-4xl mb-4">🎯</div>
            <h4 className="text-xl font-semibold mb-2">Score Points When Events Resolve</h4>
            <p className="text-gray-400">
              Earn points based on correctness, difficulty, and streaks. Long-shot bonuses reward bold predictions.
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl">
            <div className="text-4xl mb-4">💰</div>
            <h4 className="text-xl font-semibold mb-2">Payouts Based on Skill</h4>
            <p className="text-gray-400">
              Prize pool distributed proportionally based on season scores. Powered by Solana for trustless payouts.
            </p>
          </div>
        </div>
      </section>

      {/* Powered By */}
      <section className="container mx-auto px-4 py-8 text-center border-t border-gray-700">
        <p className="text-gray-500 text-sm">
          Powered by <span className="text-purple-400">Solana</span> + <span className="text-blue-400">Polymarket</span>
        </p>
      </section>
    </div>
  );
}
