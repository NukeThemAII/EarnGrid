import express from "express";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

import { loadConfig } from "./config.js";
import * as store from "./db.js";
import { VaultIndexer } from "./indexer.js";

const config = loadConfig();
store.initDatabase(config.databaseUrl);

if (config.vaultAddress === "0x0000000000000000000000000000000000000000") {
  console.log("No vault address configured — indexer will run in stub mode (API only).");
}

const client = createPublicClient({
  chain: base,
  transport: http(config.rpcUrl),
});

const indexer = new VaultIndexer(client as any, store, config);
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/tvl", (_req, res) => {
  const snapshot = store.getLatestSnapshot();
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

app.get("/api/allocations", (_req, res) => {
  const latest = store.getLatestAllocations();
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

app.get("/api/allocations/history", (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 48), 1), 720);
  const snapshots = store.getAllocationHistory(limit);

  res.json({
    snapshots: snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      blockNumber: snapshot.blockNumber,
      allocations: snapshot.allocations.map((row) => ({
        strategy: row.strategy,
        assets: row.assets,
        tier: row.tier,
        capAssets: row.cap_assets,
        enabled: row.enabled === 1,
        isSynchronous: row.is_synchronous === 1,
      })),
    })),
  });
});

app.get("/api/apy", (_req, res) => {
  const latest = store.getLatestSnapshot();
  if (!latest) {
    res.status(404).json({ error: "no_snapshot" });
    return;
  }

  const now = latest.timestamp;
  const sevenDays = 7 * 24 * 60 * 60;
  const thirtyDays = 30 * 24 * 60 * 60;

  const snapshot7d = store.getSnapshotAtOrBefore(now - sevenDays);
  const snapshot30d = store.getSnapshotAtOrBefore(now - thirtyDays);

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

app.get("/api/price-history", (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 48), 2), 720);
  const snapshots = store.getRecentSnapshots(limit);

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

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) {
        hits.delete(key);
      }
    }
  }, 60_000).unref();

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
  let start: bigint;
  let end: bigint;
  try {
    start = BigInt(startPrice);
    end = BigInt(endPrice);
  } catch {
    return 0;
  }
  if (start === 0n || end === 0n) {
    return 0;
  }
  const scale = 10n ** 18n;
  const ratio = Number((end * scale) / start) / 1e18;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0;
  }
  return Math.pow(ratio, 365 / days) - 1;
}
