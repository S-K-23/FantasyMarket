const BASE_URL = 'https://gamma-api.polymarket.com';

export interface Market {
  id: string;
  conditionId: string;
  question: string;
  slug: string;
  resolutionDate: string; // ISO string
  endDate: string; // ISO string
  tokens: {
    tokenId: string;
    outcome: string; // "Yes", "No"
    price: number;
    winner: boolean;
  }[];
  active: boolean;
  closed: boolean;
  volume: number;
  liquidity: number;
  tags: { id: string; label: string; slug: string }[];
  image?: string;
  description?: string;
}

export async function getMarkets(params: Record<string, any> = {}): Promise<Market[]> {
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

export async function getMarket(id: string): Promise<Market | null> {
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
