import "dotenv/config";
import { type Address } from "viem";

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

  const rpcUrl = envStr("RPC_URL", missing);
  const privateKey = envStr("PRIVATE_KEY", missing) as `0x${string}`;
  const vaultAddress = envStr("VAULT_ADDRESS", missing) as Address;

  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  return {
    rpcUrl: rpcUrl!,
    privateKey,
    vaultAddress,
    morphoApiUrl: process.env.MORPHO_API_URL ?? "https://blue-api.morpho.org/graphql",
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 43_200_000),
    harvestIntervalMs: Number(process.env.HARVEST_INTERVAL_MS ?? 21_600_000),
    minApyImprovementBps: Number(process.env.MIN_APY_IMPROVEMENT_BPS ?? 50),
    gasLimitBump: Number(process.env.GAS_LIMIT_BUMP ?? 1.2),
    dryRun: (process.env.DRY_RUN ?? "false").toLowerCase() === "true",
    chainId: Number(process.env.CHAIN_ID ?? 8453),
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
