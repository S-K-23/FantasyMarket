const BASE_URL = 'https://gamma-api.polymarket.com';

export interface GammaMarket {
  id: string;
  question: string;
  description: string;
  category: string;
  slug: string;
  endDate: string; // ISO string
  active: boolean;
  closed: boolean;
  liquidity: number | string;
  volume: number | string;
  outcomes: string[] | string; // May come as JSON string from API
  outcomePrices: string[] | string; // May come as JSON string "[\"0.65\", \"0.35\"]"
  clobTokenIds: string[] | string; // May come as JSON string
  tokens?: {
    tokenId: string;
    outcome: string;
    price: number;
    winner: boolean;
  }[];
}

export interface MarketFilterParams {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  category?: string;
  order?: string; // "liquidity" | "volume" | "endDate"
  ascending?: boolean;
  min_liquidity?: number;
  resolves_before?: string; // ISO date
}

export async function getMarkets(params: MarketFilterParams = {}): Promise<GammaMarket[]> {
  const url = new URL(`${BASE_URL}/markets`);

  // Default params
  if (!params.limit) params.limit = 50;
  if (!params.active) params.active = true;
  if (!params.closed) params.closed = false;

  Object.keys(params).forEach(key => url.searchParams.append(key, String(params[key])));

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`Failed to fetch markets: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}

export async function getMarket(id: string): Promise<GammaMarket | null> {
  try {
    const res = await fetch(`${BASE_URL}/markets/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch market ${id}: ${res.statusText}`);
    }
    return res.json();
  } catch (error) {
    console.error(`Error fetching market ${id}:`, error);
    return null;
  }
}

