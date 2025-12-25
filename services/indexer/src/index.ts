import express from "express";
import { createPublicClient, http } from "viem";

import { loadConfig } from "./config.js";
import { createDatabase, initializeSchema } from "./db.js";
import { VaultIndexer } from "./indexer.js";
import {
  getLatestAllocations,
  getLatestSnapshot,
  getRecentSnapshots,
  getSnapshotAtOrBefore,
} from "./queries.js";

const config = loadConfig();

const db = createDatabase({ databaseUrl: config.databaseUrl });
await initializeSchema(db);

const client = createPublicClient({
  transport: http(config.rpcUrl),
});

const indexer = new VaultIndexer(client, db, config);
await indexer.init();
indexer.start();

const app = express();
app.set("trust proxy", 1);
app.use(
  createRateLimiter({
    windowMs: config.rateLimitWindowSec * 1000,
    max: config.rateLimitMax,
  })
);

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/tvl", async (_req, res) => {
  const snapshot = await getLatestSnapshot(db);
  if (!snapshot) {
    res.status(404).json({ error: "no_snapshot" });
    return;
  }

  res.json({
    timestamp: snapshot.timestamp,
    blockNumber: snapshot.block_number,
    totalAssets: snapshot.total_assets,
    totalSupply: snapshot.total_supply,
    assetsPerShare: snapshot.assets_per_share,
  });
});

app.get("/api/allocations", async (_req, res) => {
  const latest = await getLatestAllocations(db);
  if (!latest) {
    res.status(404).json({ error: "no_allocations" });
    return;
  }

  res.json({
    timestamp: latest.timestamp,
    blockNumber: latest.blockNumber,
    allocations: latest.allocations.map((row) => ({
      strategy: row.strategy,
      assets: row.assets,
      tier: row.tier,
      capAssets: row.cap_assets,
      enabled: row.enabled === 1,
      isSynchronous: row.is_synchronous === 1,
    })),
  });
});

app.get("/api/apy", async (_req, res) => {
  const latest = await getLatestSnapshot(db);
  if (!latest) {
    res.status(404).json({ error: "no_snapshot" });
    return;
  }

  const now = latest.timestamp;
  const sevenDays = 7 * 24 * 60 * 60;
  const thirtyDays = 30 * 24 * 60 * 60;

  const [snapshot7d, snapshot30d] = await Promise.all([
    getSnapshotAtOrBefore(db, now - sevenDays),
    getSnapshotAtOrBefore(db, now - thirtyDays),
  ]);

  const apy7d = snapshot7d ? computeApy(snapshot7d.assets_per_share, latest.assets_per_share, 7) : null;
  const apy30d = snapshot30d
    ? computeApy(snapshot30d.assets_per_share, latest.assets_per_share, 30)
    : null;

  res.json({
    timestamp: latest.timestamp,
    assetsPerShare: latest.assets_per_share,
    apy7d,
    apy30d,
    snapshots: {
      latest: latest.timestamp,
      sevenDay: snapshot7d?.timestamp ?? null,
      thirtyDay: snapshot30d?.timestamp ?? null,
    },
  });
});

app.get("/api/price-history", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 48), 2), 720);
  const snapshots = await getRecentSnapshots(db, limit);

  res.json({
    snapshots: snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      assetsPerShare: snapshot.assets_per_share,
    })),
  });
});

app.listen(config.port, () => {
  console.log(`Indexer API listening on :${config.port}`);
});

function createRateLimiter(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const now = Date.now();
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "rate_limited", retryAfterSec: retryAfter });
      return;
    }

    next();
  };
}

function computeApy(startPrice: string, endPrice: string, days: number): number {
  const start = Number(startPrice);
  const end = Number(endPrice);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) {
    return 0;
  }
  const ratio = end / start;
  return Math.pow(ratio, 365 / days) - 1;
}
