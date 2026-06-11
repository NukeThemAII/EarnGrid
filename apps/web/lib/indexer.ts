export type TvlResponse = {
  timestamp: number;
  blockNumber: number;
  totalAssets: string;
  totalSupply: string;
  assetsPerShare: string;
};

export type ApyResponse = {
  timestamp: number;
  assetsPerShare: string;
  apy7d: number | null;
  apy30d: number | null;
  snapshots: {
    latest: number;
    sevenDay: number | null;
    thirtyDay: number | null;
  };
};

export type AllocationResponse = {
  timestamp: number;
  blockNumber: number;
  allocations: {
    strategy: string;
    assets: string;
    tier: number;
    capAssets: string;
    enabled: boolean;
    isSynchronous: boolean;
  }[];
};

export type AllocationHistoryResponse = {
  snapshots: {
    timestamp: number;
    blockNumber: number;
    allocations: AllocationResponse["allocations"];
  }[];
};

export type PriceHistoryResponse = {
  snapshots: {
    timestamp: number;
    assetsPerShare: string;
  }[];
};

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:3001";
}

const INDEXER_FETCH_TIMEOUT_MS = 2_000;

export async function fetchTvl(): Promise<TvlResponse | null> {
  return fetchJson<TvlResponse>("/api/tvl");
}

export async function fetchApy(): Promise<ApyResponse | null> {
  return fetchJson<ApyResponse>("/api/apy");
}

export async function fetchAllocations(): Promise<AllocationResponse | null> {
  return fetchJson<AllocationResponse>("/api/allocations");
}

export async function fetchAllocationHistory(limit = 72): Promise<AllocationHistoryResponse | null> {
  return fetchJson<AllocationHistoryResponse>(`/api/allocations/history?limit=${limit}`);
}

export async function fetchPriceHistory(limit = 48): Promise<PriceHistoryResponse | null> {
  return fetchJson<PriceHistoryResponse>(`/api/price-history?limit=${limit}`);
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INDEXER_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
