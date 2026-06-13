/**
 * Force a snapshot of the EarnGrid vault into the indexer DB.
 * Run with: npx tsx force-snapshot.ts
 */

import { createPublicClient, http } from "viem";
import { blendedVaultAbi } from "./src/abi/blendedVault.js";
import * as fs from "node:fs";

const VAULT = "0x047e35f587CF99423A6cF90c02bbD95d16Feb24B" as const;
const RPC = "https://mainnet.base.org";
const DB = "./indexer.db.json";

const client = createPublicClient({ transport: http(RPC) });

async function main() {
  const block = await client.getBlock();
  const blockNumber = Number(block.number ?? 0n);
  const blockTimestamp = Number(block.timestamp ?? BigInt(Math.floor(Date.now() / 1000)));

  const [totalAssets, totalSupply, aps, stratList] = await Promise.all([
    client.readContract({ address: VAULT, abi: blendedVaultAbi, functionName: "totalAssets" }),
    client.readContract({ address: VAULT, abi: blendedVaultAbi, functionName: "totalSupply" }),
    client.readContract({ address: VAULT, abi: blendedVaultAbi, functionName: "assetsPerShare" }),
    client.readContract({ address: VAULT as `0x${string}`, abi: blendedVaultAbi, functionName: "getStrategies" }),
  ]);

  console.log("totalAssets:", (totalAssets as bigint).toString());
  console.log("totalSupply:", (totalSupply as bigint).toString());
  console.log("assetsPerShare:", (aps as bigint).toString());

  const strategies = stratList as readonly `0x${string}`[];
  console.log("strategies:", strategies.length);

  const allocations = [];
  for (const addr of strategies) {
    try {
      const [cfgRaw, assetsRaw] = await Promise.all([
        client.readContract({
          address: VAULT, abi: blendedVaultAbi, functionName: "strategies", args: [addr],
        }),
        client.readContract({
          address: VAULT, abi: blendedVaultAbi, functionName: "strategyAssets", args: [addr],
        }),
      ]);
      const cfg = cfgRaw as unknown as { 2: number; 3: bigint; 1: boolean; 4: boolean };
      allocations.push({
        timestamp: blockTimestamp,
        block_number: blockNumber,
        strategy: addr,
        assets: (assetsRaw as bigint).toString(),
        tier: cfg[2],
        cap_assets: cfg[3].toString(),
        enabled: cfg[1] ? 1 : 0,
        is_synchronous: cfg[4] ? 1 : 0,
      });
      console.log(" ", addr, (assetsRaw as bigint).toString(), "assets");
    } catch (err: any) {
      console.warn(" ", addr, "skipped:", err.message);
    }
  }

  const data = JSON.parse(fs.readFileSync(DB, "utf8"));

  data.snapshots.push({
    id: data.snapshots.length + 1,
    timestamp: blockTimestamp,
    block_number: blockNumber,
    total_assets: (totalAssets as bigint).toString(),
    total_supply: (totalSupply as bigint).toString(),
    assets_per_share: (aps as bigint).toString(),
  });

  for (const alloc of allocations) {
    data.allocation_snapshots.push({
      id: data.allocation_snapshots.length + 1,
      ...alloc,
    });
  }

  data.indexer_state.lastSampleTimestamp = String(blockTimestamp);
  data.indexer_state.lastProcessedBlock = String(blockNumber);

  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
  console.log(`\nSnapshot written. TVL: ${Number(totalAssets as bigint) / 1e6} USDC, ${allocations.length} strategies`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
