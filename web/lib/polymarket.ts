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
  liquidity: number;
  volume: number;
  outcomes: string[]; // ["Yes", "No"]
  outcomePrices: string[]; // ["0.65", "0.35"]
  clobTokenIds: string[]; // ["token_yes", "token_no"]
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
  const queryParams: Record<string, string> = {
    limit: String(params.limit || 50),
    offset: String(params.offset || 0),
    active: String(params.active ?? true),
    closed: String(params.closed ?? false),
  };

  if (params.category) queryParams.category = params.category;
  if (params.order) queryParams.order = params.order;
  if (params.ascending !== undefined) queryParams.ascending = String(params.ascending);
  // Note: Gamma API might not support min_liquidity directly in query, we might need to filter client side
  // But let's check if we can pass it. If not, we filter after fetch.
  // We'll assume we filter client side for complex filters not supported by API.

  Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));

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

