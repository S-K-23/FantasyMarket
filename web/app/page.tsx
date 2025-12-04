import Link from 'next/link';
import { WalletButton } from '@/components/ui/wallet-button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Fantasy Forecast League</h1>
          <WalletButton />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6">
          Fantasy Forecast League
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Season-long leagues built on prediction markets. Draft real-world events, earn points based on correctness and difficulty, win proportional payouts.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/league/create"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Create a League
          </Link>
          <Link
            href="/leagues"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Browse Leagues
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-card p-6 rounded-lg border">
            <div className="text-4xl mb-4">📊</div>
            <h4 className="text-xl font-semibold mb-2">Draft Markets, Not Players</h4>
            <p className="text-muted-foreground">
              Snake draft prediction markets from Polymarket. Choose YES or NO on real-world events.
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border">
            <div className="text-4xl mb-4">🎯</div>
            <h4 className="text-xl font-semibold mb-2">Score Points When Events Resolve</h4>
            <p className="text-muted-foreground">
              Earn points based on correctness, difficulty, and streaks. Long-shot bonuses reward bold predictions.
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border">
            <div className="text-4xl mb-4">💰</div>
            <h4 className="text-xl font-semibold mb-2">Payouts Based on Skill</h4>
            <p className="text-muted-foreground">
              Prize pool distributed proportionally based on season scores. Powered by Solana for trustless payouts.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
