'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { QRCodeSVG } from 'qrcode.react';
import LeaderboardTable from '@/components/league/LeaderboardTable';
import ActivePicksPanel from '@/components/league/ActivePicksPanel';
import LobbyNews from '@/components/league/LobbyNews';
import LobbyAnalytics from '@/components/league/LobbyAnalytics';

interface Player {
    id: number;
    address: string;
    points: number;
    streak: number;
}

interface League {
    id: number;
    leagueId: string;
    name: string;
    creator: string;
    buyIn: number;
    currency: string;
    maxPlayers: number;
    currentPlayers: number;
    totalSessions: number;
    marketsPerSession: number;
    status: string;
    currentSession: number;
    draftOrder: string[];
    category?: string;
}

export default function LeagueLobby() {
    const params = useParams();
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'news'>('overview');

    // Fetch live scores
    const [scores, setScores] = useState<any>(null);

    const fetchData = useCallback(async () => {
        if (!params.id) return;

        try {
            // Fetch league
            const leagueRes = await fetch(`/api/leagues?id=${params.id}`);
            const leagueData = await leagueRes.json();
            const leagueInfo = Array.isArray(leagueData) ? leagueData[0] : leagueData;
            setLeague(leagueInfo);

            // Fetch players
            if (leagueInfo?.id) {
                const playersRes = await fetch(`/api/leagues/${leagueInfo.id}/players`);
                if (playersRes.ok) {
                    const playersData = await playersRes.json();
                    setPlayers(playersData.players || []);
                }

                // Fetch live scores if active or drafting
                if (leagueInfo.status === 'ACTIVE' || leagueInfo.status === 'DRAFTING') {
                    const scoresRes = await fetch(`/api/scores/live?league_id=${leagueInfo.id}`);
                    const scoresData = await scoresRes.json();
                    setScores(scoresData);
                }
            }

            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const isCreator = connected && publicKey && league?.creator === publicKey.toBase58();
    const canStartDraft = isCreator && players.length >= 2 && league?.status === 'SETUP';

    const handleStartDraft = async () => {
        if (!canStartDraft || !publicKey) return;
        setStarting(true);
        try {
            const res = await fetch('/api/draft/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId: league?.leagueId || params.id,
                    creator: publicKey.toBase58()
                })
            });

            if (res.ok) {
                router.push(`/league/${params.id}/draft`);
            } else {
                const error = await res.json();
                alert(`Failed to start draft: ${error.error}`);
            }
        } catch (error) {
            console.error('Start draft error:', error);
            alert('Failed to start draft');
        }
        setStarting(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-white text-xl font-light tracking-wider">LOADING LOBBY...</div>
                </div>
            </div>
        );
    }

    if (!league) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
                <div className="text-center text-white">
                    <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-500">League Not Found</h1>
                    <Link href="/" className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-full transition">Return Home</Link>
                </div>
            </div>
        );
    }

    const prizePool = league.buyIn * players.length;
    const isSetup = league.status === 'SETUP';

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white selection:bg-blue-500/30">
            {/* Navbar */}
            <nav className="border-b border-white/5 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold hover:text-blue-400 transition flex items-center gap-2">
                        <span className="text-2xl">⚡</span> FantasyMarket
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 text-sm text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-full border border-white/5">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Network Active
                        </div>
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-white/10 shadow-2xl mb-8">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                    <div className="relative p-8 md:p-12">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border ${league.status === 'SETUP' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                        league.status === 'DRAFTING' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                            'bg-green-500/10 border-green-500/20 text-green-400'
                                        }`}>
                                        {league.status}
                                    </span>
                                    <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase bg-gray-700/30 border border-white/5 text-gray-300">
                                        {league.category || 'General'}
                                    </span>
                                </div>
                                <h1 className="text-5xl md:text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                                    {league.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-6 text-gray-400 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">👥</span>
                                        {league.currentPlayers}/{league.maxPlayers} Players
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">💰</span>
                                        <span className="text-white font-bold">{prizePool} {league.currency}</span> Prize Pool
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">📅</span>
                                        Session {league.currentSession}/{league.totalSessions}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-3 min-w-[200px]">
                                {league.status === 'DRAFTING' && (
                                    <Link
                                        href={`/league/${params.id}/draft`}
                                        className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-center transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                        <span className="relative flex items-center justify-center gap-2">
                                            🎯 Enter Draft Room
                                        </span>
                                    </Link>
                                )}
                                {isCreator && isSetup && (
                                    <button
                                        onClick={handleStartDraft}
                                        disabled={!canStartDraft || starting}
                                        className={`px-8 py-4 rounded-2xl font-bold text-center transition-all ${canStartDraft && !starting
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-105 shadow-lg shadow-blue-900/20'
                                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                                            }`}
                                    >
                                        {starting ? 'Starting Engine...' : '🚀 Start Season'}
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                                        navigator.clipboard.writeText(`${baseUrl}/league/join/${league.leagueId}`);
                                        alert('Invite link copied!');
                                    }}
                                    className="px-8 py-3 bg-gray-800/50 hover:bg-gray-800 border border-white/10 rounded-2xl font-medium text-sm transition text-gray-300 hover:text-white"
                                >
                                    🔗 Copy Invite Link
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    {!isSetup && (
                        <div className="flex items-center gap-1 px-8 pb-0 border-t border-white/5 bg-black/20">
                            {[
                                { id: 'overview', label: 'Overview', icon: '📊' },
                                { id: 'analytics', label: 'Analytics', icon: '📈' },
                                { id: 'news', label: 'News Feed', icon: '📰' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                                        : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-3 gap-8">

                    {/* Left Column (Main) */}
                    <div className="lg:col-span-2 space-y-6">

                        {isSetup ? (
                            /* Setup State: Player List */
                            <div className="bg-gray-900/50 backdrop-blur border border-white/10 rounded-3xl p-8">
                                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">👥</span>
                                    Lobby ({players.length}/{league.maxPlayers})
                                </h3>

                                <div className="grid gap-3">
                                    {players.map((player, index) => {
                                        const isMe = publicKey && player.address === publicKey.toBase58();
                                        return (
                                            <div key={player.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isMe
                                                ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                                : 'bg-gray-800/30 border-white/5 hover:bg-gray-800/50'
                                                }`}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-mono font-medium text-gray-200">
                                                            {player.address.slice(0, 6)}...{player.address.slice(-4)}
                                                        </div>
                                                        <div className="flex gap-2 mt-1">
                                                            {isMe && <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">You</span>}
                                                            {player.address === league.creator && <span className="text-[10px] uppercase font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Creator</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                                    Ready
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Empty Slots */}
                                    {Array.from({ length: Math.max(0, league.maxPlayers - players.length) }).map((_, i) => (
                                        <div key={`empty-${i}`} className="p-4 rounded-xl border border-dashed border-gray-700 bg-gray-900/20 flex items-center justify-center text-gray-600 font-medium">
                                            Waiting for player...
                                        </div>
                                    ))}
                                </div>

                                {!isCreator && players.length >= 2 && (
                                    <div className="mt-8 p-4 bg-blue-900/20 border border-blue-500/20 rounded-xl text-center">
                                        <p className="text-blue-200 animate-pulse">
                                            ⏳ Waiting for host to start the draft...
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Active/Drafting State Content */
                            <>
                                {activeTab === 'overview' && (
                                    <>
                                        {/* Live Leaderboard */}
                                        <div className="bg-gray-900/50 backdrop-blur border border-white/10 rounded-3xl overflow-hidden">
                                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                                                <h2 className="text-xl font-bold flex items-center gap-2">
                                                    🏆 Live Standings
                                                </h2>
                                                <span className="text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded-full flex items-center gap-2 border border-green-500/20">
                                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                                                    LIVE
                                                </span>
                                            </div>
                                            {scores?.players && scores.players.length > 0 ? (
                                                <LeaderboardTable
                                                    players={scores.players}
                                                    currentPlayerAddress={publicKey?.toBase58()}
                                                />
                                            ) : (
                                                <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-4">
                                                    <div className="text-4xl">📊</div>
                                                    <p>Waiting for draft results to populate standings...</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Active Picks */}
                                        {publicKey && (
                                            <ActivePicksPanel
                                                leagueId={String(league.id)}
                                                playerAddress={publicKey.toBase58()}
                                            />
                                        )}
                                    </>
                                )}

                                {activeTab === 'analytics' && (
                                    <LobbyAnalytics
                                        players={players}
                                        prizePool={prizePool}
                                        currency={league.currency}
                                    />
                                )}

                                {activeTab === 'news' && (
                                    <LobbyNews category={league.category || 'Pop Culture'} />
                                )}
                            </>
                        )}
                    </div>

                    {/* Right Column (Sidebar) */}
                    <div className="space-y-6">
                        {/* Invite / QR Card - RESTORED/MERGED FEATURE */}
                        <div className="bg-gray-900/50 backdrop-blur border border-white/10 rounded-3xl p-6">
                            <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wider mb-4">Invite Friend</h3>
                            <div className="flex justify-center bg-white p-4 rounded-xl mb-4">
                                <QRCodeSVG
                                    value={typeof window !== 'undefined'
                                        ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/league/join/${league.leagueId}`
                                        : ''}
                                    size={150}
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>
                            <p className="text-center text-sm text-gray-400">
                                Scan to join instantly
                            </p>
                        </div>

                        {/* League Stats Card */}
                        <div className="bg-gray-900/50 backdrop-blur border border-white/10 rounded-3xl p-6">
                            <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wider mb-4">League Settings</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                                    <span className="text-gray-400 text-sm">Buy-in</span>
                                    <span className="font-mono font-bold text-blue-400">{league.buyIn} {league.currency}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                                    <span className="text-gray-400 text-sm">Total Sessions</span>
                                    <span className="font-mono font-bold">{league.totalSessions}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                                    <span className="text-gray-400 text-sm">Markets/Session</span>
                                    <span className="font-mono font-bold">{league.marketsPerSession}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                                    <span className="text-gray-400 text-sm">Category</span>
                                    <span className="font-medium text-purple-400">{league.category || 'All'}</span>
                                </div>
                            </div>
                        </div>

                        {/* News Widget (Small) - Only show if not on news tab */}
                        {activeTab !== 'news' && !isSetup && (
                            <div className="bg-gray-900/50 backdrop-blur border border-white/10 rounded-3xl overflow-hidden">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Latest News</h3>
                                    <button
                                        onClick={() => setActiveTab('news')}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        View All
                                    </button>
                                </div>
                                <div className="max-h-[300px] overflow-hidden relative">
                                    <LobbyNews category={league.category || 'Pop Culture'} />
                                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
