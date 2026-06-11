import { Kysely, PostgresDialect, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import { Pool } from "pg";

import type { DB } from "./schema.js";

export type DatabaseClient = Kysely<DB>;

export type DatabaseOptions = {
  databaseUrl: string;
};

export function createDatabase(options: DatabaseOptions): DatabaseClient {
  const { databaseUrl } = options;

  if (isPostgresUrl(databaseUrl)) {
    return new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: databaseUrl }),
      }),
    });
  }

  const sqlitePath = parseSqlitePath(databaseUrl);
  return new Kysely<DB>({
    dialect: new SqliteDialect({
      database: new Database(sqlitePath),
    }),
  });
}

export async function initializeSchema(db: DatabaseClient): Promise<void> {
  await db.schema
    .createTable("indexer_state")
    .ifNotExists()
    .addColumn("key", "text", (col) => col.primaryKey())
    .addColumn("value", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("events")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("block_number", "integer", (col) => col.notNull())
    .addColumn("block_hash", "text", (col) => col.notNull())
    .addColumn("tx_hash", "text", (col) => col.notNull())
    .addColumn("log_index", "integer", (col) => col.notNull())
    .addColumn("event_name", "text", (col) => col.notNull())
    .addColumn("event_data", "text", (col) => col.notNull())
    .addColumn("created_at", "integer", (col) => col.notNull())
    .addUniqueConstraint("events_tx_log_unique", ["tx_hash", "log_index"])
    .execute();

  await db.schema
    .createTable("snapshots")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("timestamp", "integer", (col) => col.notNull())
    .addColumn("block_number", "integer", (col) => col.notNull())
    .addColumn("total_assets", "text", (col) => col.notNull())
    .addColumn("total_supply", "text", (col) => col.notNull())
    .addColumn("assets_per_share", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("allocation_snapshots")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("timestamp", "integer", (col) => col.notNull())
    .addColumn("block_number", "integer", (col) => col.notNull())
    .addColumn("strategy", "text", (col) => col.notNull())
    .addColumn("assets", "text", (col) => col.notNull())
    .addColumn("tier", "integer", (col) => col.notNull())
    .addColumn("cap_assets", "text", (col) => col.notNull())
    .addColumn("enabled", "integer", (col) => col.notNull())
    .addColumn("is_synchronous", "integer", (col) => col.notNull())
    .execute();

  // Indexes for query performance
  await db.schema
    .createIndex("idx_snapshots_timestamp")
    .ifNotExists()
    .on("snapshots")
    .column("timestamp")
    .execute();

  await db.schema
    .createIndex("idx_allocation_snapshots_timestamp")
    .ifNotExists()
    .on("allocation_snapshots")
    .column("timestamp")
    .execute();

  await db.schema
    .createIndex("idx_events_block_number")
    .ifNotExists()
    .on("events")
    .column("block_number")
    .execute();
}

function isPostgresUrl(databaseUrl: string): boolean {
  return databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://");
}

function parseSqlitePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("sqlite:")) {
    const path = databaseUrl.replace("sqlite:", "").trim();
    return path.length > 0 ? path : "./indexer.db";
  }

  if (databaseUrl.startsWith("file:")) {
    try {
      const url = new URL(databaseUrl);
      return url.pathname || "./indexer.db";
    } catch {
      return "./indexer.db";
    }
  }

  return databaseUrl.length > 0 ? databaseUrl : "./indexer.db";
}
