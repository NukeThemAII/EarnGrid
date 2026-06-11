import "dotenv/config";
import { type Address } from "viem";
import { base, baseSepolia } from "viem/chains";

export interface Config {
  rpcUrl: string;
  privateKey: `0x${string}`;
  vaultAddress: Address;
  morphoApiUrl: string;
  pollIntervalMs: number;
  harvestIntervalMs: number;
  minApyImprovementBps: number;
  gasLimitBump: number;
  dryRun: boolean;
  chainId: number;
}

export function loadConfig(): Config {
  const missing: string[] = [];

  const privateKey = envStr("PRIVATE_KEY", missing) as `0x${string}`;
  const vaultAddress = envStr("VAULT_ADDRESS", missing) as Address;
  const chainId = envNumber("CHAIN_ID", 8453);
  const rpcUrl = process.env.RPC_URL || defaultPublicRpcUrl(chainId);

  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  return {
    rpcUrl: rpcUrl!,
    privateKey,
    vaultAddress,
    morphoApiUrl: process.env.MORPHO_API_URL ?? "https://blue-api.morpho.org/graphql",
    pollIntervalMs: envNumber("POLL_INTERVAL_MS", 43_200_000),
    harvestIntervalMs: envNumber("HARVEST_INTERVAL_MS", 21_600_000),
    minApyImprovementBps: envNumber("MIN_APY_IMPROVEMENT_BPS", 50),
    gasLimitBump: envNumber("GAS_LIMIT_BUMP", 1.2),
    dryRun: (process.env.DRY_RUN ?? "false").toLowerCase() === "true",
    chainId,
  };
}

function envStr(key: string, missing: string[]): string | undefined {
  const val = process.env[key];
  if (!val || val === "" || val.startsWith("0x...")) {
    missing.push(key);
    return undefined;
  }
  return val;
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric env var ${key}: ${raw}`);
  }
  return value;
}

function defaultPublicRpcUrl(chainId: number): string {
  return chainId === baseSepolia.id ? baseSepolia.rpcUrls.default.http[0] : base.rpcUrls.default.http[0];
}
