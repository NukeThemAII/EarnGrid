import type { InsertObject, Kysely, Selectable } from "kysely";

import type {
  AllocationSnapshotsTable,
  DB,
  EventsTable,
  IndexerStateTable,
  SnapshotsTable,
} from "./schema.js";

export type SnapshotRow = Selectable<SnapshotsTable>;
export type AllocationSnapshotRow = Selectable<AllocationSnapshotsTable>;

export async function getState(db: Kysely<DB>, key: string): Promise<string | null> {
  const row = await db
    .selectFrom("indexer_state")
    .select(["value"])
    .where("key", "=", key)
    .executeTakeFirst();

  return row?.value ?? null;
}

export async function setState(db: Kysely<DB>, key: string, value: string): Promise<void> {
  await db
    .insertInto("indexer_state")
    .values({ key, value })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value }))
    .execute();
}

export async function insertEvent(
  db: Kysely<DB>,
  event: InsertObject<DB, "events">
): Promise<void> {
  await db
    .insertInto("events")
    .values(event)
    .onConflict((oc) => oc.columns(["tx_hash", "log_index"]).doNothing())
    .execute();
}

export async function insertSnapshot(
  db: Kysely<DB>,
  snapshot: InsertObject<DB, "snapshots">
): Promise<void> {
  await db.insertInto("snapshots").values(snapshot).execute();
}

export async function insertAllocationSnapshots(
  db: Kysely<DB>,
  snapshots: InsertObject<DB, "allocation_snapshots">[]
): Promise<void> {
  if (snapshots.length === 0) {
    return;
  }
  await db.insertInto("allocation_snapshots").values(snapshots).execute();
}

export async function getLatestSnapshot(db: Kysely<DB>): Promise<SnapshotRow | null> {
  return db
    .selectFrom("snapshots")
    .selectAll()
    .orderBy("timestamp", "desc")
    .limit(1)
    .executeTakeFirst();
}

export async function getSnapshotAtOrBefore(
  db: Kysely<DB>,
  timestamp: number
): Promise<SnapshotRow | null> {
  return db
    .selectFrom("snapshots")
    .selectAll()
    .where("timestamp", "<=", timestamp)
    .orderBy("timestamp", "desc")
    .limit(1)
    .executeTakeFirst();
}

export async function getLatestAllocations(
  db: Kysely<DB>
): Promise<{ timestamp: number; blockNumber: number; allocations: AllocationSnapshotRow[] } | null> {
  const latest = await db
    .selectFrom("allocation_snapshots")
    .select(["timestamp", "block_number"])
    .orderBy("timestamp", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!latest) {
    return null;
  }

  const allocations = await db
    .selectFrom("allocation_snapshots")
    .selectAll()
    .where("timestamp", "=", latest.timestamp)
    .execute();

  return {
    timestamp: latest.timestamp,
    blockNumber: latest.block_number,
    allocations,
  };
}

export async function getAllocationHistory(
  db: Kysely<DB>,
  limit: number = 48
): Promise<{ timestamp: number; blockNumber: number; allocations: AllocationSnapshotRow[] }[]> {
  const buckets = await db
    .selectFrom("allocation_snapshots")
    .select(["timestamp", "block_number"])
    .groupBy(["timestamp", "block_number"])
    .orderBy("timestamp", "desc")
    .limit(limit)
    .execute();

  if (buckets.length === 0) {
    return [];
  }

  const timestamps = buckets.map((b) => b.timestamp);
  const allRows = await db
    .selectFrom("allocation_snapshots")
    .selectAll()
    .where("timestamp", "in", timestamps)
    .execute();

  const byTimestamp = new Map<number, AllocationSnapshotRow[]>();
  for (const row of allRows) {
    const existing = byTimestamp.get(row.timestamp);
    if (existing) {
      existing.push(row);
    } else {
      byTimestamp.set(row.timestamp, [row]);
    }
  }

  return buckets.map((bucket) => ({
    timestamp: bucket.timestamp,
    blockNumber: bucket.block_number,
    allocations: byTimestamp.get(bucket.timestamp) ?? [],
  }));
}

export async function getRecentSnapshots(
  db: Kysely<DB>,
  limit: number
): Promise<SnapshotRow[]> {
  const rows = await db
    .selectFrom("snapshots")
    .selectAll()
    .orderBy("timestamp", "desc")
    .limit(limit)
    .execute();

  return rows.reverse();
}

export async function recordStartBlock(db: Kysely<DB>, startBlock: number): Promise<void> {
  await setState(db, "startBlock", String(startBlock));
}

export async function recordLastProcessedBlock(db: Kysely<DB>, blockNumber: number): Promise<void> {
  await setState(db, "lastProcessedBlock", String(blockNumber));
}

export async function recordLastSampleTimestamp(db: Kysely<DB>, timestamp: number): Promise<void> {
  await setState(db, "lastSampleTimestamp", String(timestamp));
}

export async function getLastProcessedBlock(db: Kysely<DB>): Promise<number | null> {
  const value = await getState(db, "lastProcessedBlock");
  return value ? Number(value) : null;
}

export async function getLastSampleTimestamp(db: Kysely<DB>): Promise<number | null> {
  const value = await getState(db, "lastSampleTimestamp");
  return value ? Number(value) : null;
}

export async function getStartBlock(db: Kysely<DB>): Promise<number | null> {
  const value = await getState(db, "startBlock");
  return value ? Number(value) : null;
}

export async function getEventCount(db: Kysely<DB>): Promise<number> {
  const result = await db.selectFrom("events").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst();
  return Number(result?.count ?? 0);
}

export type EventInsert = InsertObject<DB, "events">;
export type SnapshotInsert = InsertObject<DB, "snapshots">;
export type AllocationSnapshotInsert = InsertObject<DB, "allocation_snapshots">;
export type IndexerStateInsert = InsertObject<DB, "indexer_state">;
