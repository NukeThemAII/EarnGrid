import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------------------
// Minimal JSON-file-based store for the indexer.
// Replaces Kysely + better-sqlite3 with zero native dependencies.
// Data is persisted to a JSON file. Acceptable for low-traffic dev/staging.
// ---------------------------------------------------------------------------

export type SnapshotRow = {
  id: number;
  timestamp: number;
  block_number: number;
  total_assets: string;
  total_supply: string;
  assets_per_share: string;
};

export type AllocationSnapshotRow = {
  id: number;
  timestamp: number;
  block_number: number;
  strategy: string;
  assets: string;
  tier: number;
  cap_assets: string;
  enabled: number;
  is_synchronous: number;
};

/** Per-strategy health metrics snapshot. */
export type StrategyHealthRow = {
  id: number;
  timestamp: number;
  block_number: number;
  strategy: string;
  /** `strategyAssets(strategy)` — current assets deployed to the strategy. */
  assets: string;
  /** `maxWithdraw` from the underlying ERC-4626 vault (liquidity check). */
  max_withdraw: string;
  /** Utilization: assets / cap_assets as a 0-1 float. */
  utilization: number;
  /** Share price change vs the previous snapshot (bps, signed). */
  share_price_delta_bps: number;
};

export type EventRow = {
  id: number;
  block_number: number;
  block_hash: string;
  tx_hash: string;
  log_index: number;
  event_name: string;
  event_data: string;
  created_at: number;
};

interface Store {
  indexer_state: Record<string, string>;
  events: EventRow[];
  snapshots: SnapshotRow[];
  allocation_snapshots: AllocationSnapshotRow[];
  strategy_health: StrategyHealthRow[];
}

let store: Store = {
  indexer_state: {},
  events: [],
  snapshots: [],
  allocation_snapshots: [],
  strategy_health: [],
};

let dbPath = "./indexer.db.json";
let nextId = { events: 1, snapshots: 1, allocations: 1 };

export function initDatabase(databaseUrl?: string) {
  if (databaseUrl && databaseUrl !== "sqlite:./indexer.db") {
    // Support custom path like sqlite:./path/to/db -> ./path/to/db.json
    const base = databaseUrl.replace(/^sqlite:/, "").replace(/\.db$/, "");
    dbPath = join(base + ".db.json");
  }
  if (existsSync(dbPath)) {
    try {
      const raw = readFileSync(dbPath, "utf-8");
      const parsed = JSON.parse(raw);
      store = {
        indexer_state: parsed.indexer_state ?? {},
        events: Array.isArray(parsed.events) ? parsed.events : [],
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
        allocation_snapshots: Array.isArray(parsed.allocation_snapshots) ? parsed.allocation_snapshots : [],
        strategy_health: Array.isArray(parsed.strategy_health) ? parsed.strategy_health : [],
      };
      nextId.events = store.events.length > 0
        ? Math.max(...store.events.map((e) => e.id)) + 1
        : 1;
      nextId.snapshots = store.snapshots.length > 0
        ? Math.max(...store.snapshots.map((s) => s.id)) + 1
        : 1;
      nextId.allocations = store.allocation_snapshots.length > 0
        ? Math.max(...store.allocation_snapshots.map((a) => a.id)) + 1
        : 1;
    } catch {
      store = { indexer_state: {}, events: [], snapshots: [], allocation_snapshots: [], strategy_health: [] };
    }
  }
  mkdirSync(dirname(dbPath), { recursive: true });
  flush();
}

function flush() {
  writeFileSync(dbPath, JSON.stringify(store, null, 2));
}

// --- Indexer state (key/value) ---

export function getState(key: string): string | null {
  return store.indexer_state[key] ?? null;
}

export function setState(key: string, value: string) {
  store.indexer_state[key] = value;
  flush();
}

// --- Events ---

export function insertEvent(event: Omit<EventRow, "id">) {
  store.events.push({ id: nextId.events++, ...event });
  flush();
}

// --- Snapshots ---

export function insertSnapshot(snapshot: Omit<SnapshotRow, "id">) {
  store.snapshots.push({ id: nextId.snapshots++, ...snapshot });
  flush();
}

export function getLatestSnapshot(): SnapshotRow | undefined {
  const sorted = [...store.snapshots].sort((a, b) => b.timestamp - a.timestamp);
  return sorted[0];
}

export function getSnapshotAtOrBefore(timestamp: number): SnapshotRow | undefined {
  const candidates = store.snapshots
    .filter((s) => s.timestamp <= timestamp)
    .sort((a, b) => b.timestamp - a.timestamp);
  return candidates[0];
}

export function getRecentSnapshots(limit: number): SnapshotRow[] {
  return [...store.snapshots]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
}

// --- Allocation snapshots ---

export function insertAllocationSnapshots(snapshots: Omit<AllocationSnapshotRow, "id">[]) {
  for (const snapshot of snapshots) {
    store.allocation_snapshots.push({ id: nextId.allocations++, ...snapshot });
  }
  flush();
}

export function getLatestAllocations(): { timestamp: number; blockNumber: number; allocations: AllocationSnapshotRow[] } | null {
  const sorted = [...store.allocation_snapshots].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  if (!latest) return null;
  return {
    timestamp: latest.timestamp,
    blockNumber: latest.block_number,
    allocations: sorted.filter((a) => a.timestamp === latest.timestamp),
  };
}

export function getAllocationHistory(limit = 48): { timestamp: number; blockNumber: number; allocations: AllocationSnapshotRow[] }[] {
  const groups = new Map<number, { timestamp: number; blockNumber: number; allocations: AllocationSnapshotRow[] }>();
  for (const row of store.allocation_snapshots) {
    if (!groups.has(row.timestamp)) {
      groups.set(row.timestamp, { timestamp: row.timestamp, blockNumber: row.block_number, allocations: [] });
    }
    groups.get(row.timestamp)!.allocations.push(row);
  }
  return [...groups.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .reverse();
}

// --- Strategy health metrics ---

export function insertStrategyHealth(rows: Omit<StrategyHealthRow, "id">[]): void {
  for (const row of rows) {
    store.strategy_health.push({ id: nextId.allocations++, ...row });
  }
  flush();
}

export function getLatestStrategyHealth(): { timestamp: number; blockNumber: number; strategies: StrategyHealthRow[] } | null {
  const sorted = [...store.strategy_health].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  if (!latest) return null;
  return {
    timestamp: latest.timestamp,
    blockNumber: latest.block_number,
    strategies: sorted.filter((s) => s.timestamp === latest.timestamp),
  };
}

// --- Reorg safety ---

/**
 * Delete all events, snapshots, and allocation snapshots with
 * `block_number > forkBlock`.  Used during reorg recovery so the
 * indexer can re-sync the replaced blocks.
 */
export function deleteAfterBlock(forkBlock: number): void {
  const before = { events: store.events.length, snapshots: store.snapshots.length, allocations: store.allocation_snapshots.length, health: store.strategy_health.length };
  store.events = store.events.filter((e) => e.block_number <= forkBlock);
  store.snapshots = store.snapshots.filter((s) => s.block_number <= forkBlock);
  store.allocation_snapshots = store.allocation_snapshots.filter((a) => a.block_number <= forkBlock);
  store.strategy_health = store.strategy_health.filter((h) => h.block_number <= forkBlock);
  console.log(
    `Reorg rollback: removed ${before.events - store.events.length} events, ` +
    `${before.snapshots - store.snapshots.length} snapshots, ` +
    `${before.allocations - store.allocation_snapshots.length} allocation snapshots, ` +
    `${before.health - store.strategy_health.length} health records`
  );
  flush();
}
