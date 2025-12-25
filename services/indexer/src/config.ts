import "dotenv/config";

export type IndexerConfig = {
  rpcUrl: string;
  vaultAddress: `0x${string}`;
  databaseUrl: string;
  startBlock?: number;
  pollIntervalMs: number;
  sampleIntervalSec: number;
  finalityBlocks: number;
  port: number;
  maxBlockRange: number;
  rateLimitWindowSec: number;
  rateLimitMax: number;
};

export function loadConfig(): IndexerConfig {
  const rpcUrl = requireEnv("INDEXER_RPC_URL");
  const vaultAddress = requireEnv("VAULT_ADDRESS") as `0x${string}`;

  return {
    rpcUrl,
    vaultAddress,
    databaseUrl: process.env.DATABASE_URL ?? "sqlite:./indexer.db",
    startBlock: parseOptionalNumber(process.env.START_BLOCK),
    pollIntervalMs: parseNumber(process.env.POLL_INTERVAL_MS, 10_000),
    sampleIntervalSec: parseNumber(process.env.SAMPLE_INTERVAL_SEC, 3_600),
    finalityBlocks: parseNumber(process.env.FINALITY_BLOCKS, 2),
    port: parseNumber(process.env.PORT, 3001),
    maxBlockRange: parseNumber(process.env.MAX_BLOCK_RANGE, 2_000),
    rateLimitWindowSec: parseNumber(process.env.RATE_LIMIT_WINDOW_SEC, 60),
    rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 120),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
