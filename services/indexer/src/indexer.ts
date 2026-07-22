import type { PublicClient } from "viem";
import { decodeEventLog } from "viem";

import { blendedVaultAbi } from "./abi/blendedVault.js";
import type { IndexerConfig } from "./config.js";
import * as store from "./db.js";

// ─────────────────────────────────────────────────────────────────────
// Retry helper — exponential backoff for rate-limited RPC calls
// ─────────────────────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit =
        error?.details?.includes?.("rate limit") ||
        error?.cause?.message?.includes?.("rate limit") ||
        error?.code === -32016;

      if (!isRateLimit || attempt === maxAttempts - 1) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30_000);
      console.warn(`Indexer: ${label} rate-limited, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export class VaultIndexer {
  private readonly client: PublicClient;
  private readonly config: IndexerConfig;
  private running = false;

  constructor(client: PublicClient, _store: typeof store, config: IndexerConfig) {
    this.client = client;
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.config.vaultAddress === ("0x0000000000000000000000000000000000000000" as `0x${string}`)) {
      console.log("VaultIndexer: skipping init (no vault deployed)");
      return;
    }
    const lastProcessed = store.getState("lastProcessedBlock");
    if (lastProcessed !== null) {
      return;
    }

    const latestBlock = Number(await this.client.getBlockNumber());
    const startBlock = this.config.startBlock ?? latestBlock;

    store.setState("startBlock", String(startBlock));
    store.setState("lastProcessedBlock", String(Math.max(startBlock - 1, 0)));

    //  Store the hash at the starting block so reorg detection has a baseline.
    if (startBlock > 0) {
      const block = await this.client.getBlock({ blockNumber: BigInt(startBlock - 1) });
      store.setState("lastProcessedBlockHash", block.hash ?? "");
    }
  }

  start(): void {
    setInterval(() => {
      void this.tick();
    }, this.config.pollIntervalMs);

    void this.tick();
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.syncEvents();
      await this.sampleIfDue();
    } catch (error) {
      console.error("Indexer tick failed", error);
    } finally {
      this.running = false;
    }
  }

  private async syncEvents(): Promise<void> {
    const lastProcessed = store.getState("lastProcessedBlock");
    if (lastProcessed === null) {
      return;
    }

    // ── Reorg detection ──────────────────────────────────────────────
    const reorg = await this.detectAndHandleReorg(Number(lastProcessed));
    if (reorg) {
      return; // tick will retry on next poll after rollback
    }

    const latestBlock = Number(await this.client.getBlockNumber());
    const targetBlock = Math.max(latestBlock - this.config.finalityBlocks, 0);

    if (Number(lastProcessed) >= targetBlock) {
      return;
    }

    let fromBlock = Number(lastProcessed) + 1;
    while (fromBlock <= targetBlock) {
      const toBlock = Math.min(fromBlock + this.config.maxBlockRange - 1, targetBlock);

      let logs;
      try {
        logs = await withRetry(
          () => this.client.getLogs({
            address: this.config.vaultAddress,
            fromBlock: BigInt(fromBlock),
            toBlock: BigInt(toBlock),
          }),
          `getLogs ${fromBlock}-${toBlock}`,
          3 // fewer retries for logs — most rate limits are hard
        );
      } catch (error: any) {
        console.warn(
          `Indexer: getLogs failed for ${fromBlock}-${toBlock}: ${error?.details ?? error?.shortMessage ?? error}. Skipping event sync, advancing ${toBlock - fromBlock + 1} blocks.`
        );
        // Advance past the failed range so we don't get stuck on the same blocks
        store.setState("lastProcessedBlock", String(toBlock));
        fromBlock = toBlock + 1;
        continue;
      }

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: blendedVaultAbi,
            data: log.data,
            topics: log.topics,
          });
          const eventName = decoded.eventName;
          const eventData = JSON.stringify(decoded.args ?? {}, (_key, val) =>
            typeof val === "bigint" ? val.toString() : val
          );

          store.insertEvent({
            block_number: Number(log.blockNumber ?? 0n),
            block_hash: log.blockHash ?? "",
            tx_hash: log.transactionHash ?? "",
            log_index: Number(log.logIndex ?? 0n),
            event_name: eventName,
            event_data: eventData,
            created_at: Math.floor(Date.now() / 1000),
          });
        } catch (error) {
          console.warn("Failed to decode log", error);
        }
      }

      store.setState("lastProcessedBlock", String(toBlock));

      //  Update the anchor hash after each range so the next range has a
      //  baseline for reorg detection.
      const toBlockHash = await this.client.getBlock({ blockNumber: BigInt(toBlock) });
      store.setState("lastProcessedBlockHash", toBlockHash.hash ?? "");

      fromBlock = toBlock + 1;
    }
  }

  /**
   * Check whether the last processed block hash still matches the chain.
   * If a reorg is detected, roll back events and snapshots past the fork
   * point and reset `lastProcessedBlock` so the next tick re-syncs.
   *
   * Returns `true` when a reorg was detected and handled (caller should
   * abort the current tick and wait for the next poll).
   */
  private async detectAndHandleReorg(lastProcessedNum: number): Promise<boolean> {
    const storedHash = store.getState("lastProcessedBlockHash");
    if (!storedHash || lastProcessedNum === 0) {
      return false;
    }

    try {
      const onchain = await this.client.getBlock({ blockNumber: BigInt(lastProcessedNum) });
      if (onchain.hash === storedHash) {
        return false; // all good
      }
    } catch {
      // RPC call failed — can't verify, skip this tick.
      return true;
    }

    console.warn(
      `Reorg detected at block ${lastProcessedNum}: stored=${storedHash}, onchain mismatch — walking back to find fork point`
    );

    // Walk backward until we find a block whose hash still matches.
    let forkBlock = lastProcessedNum - 1;
    let found = false;

    for (let attempt = 0; attempt < 128 && forkBlock >= 0; attempt++) {
      const storedHashAtFork = forkBlock === Number(store.getState("startBlock") ?? 0) - 1
        ? store.getState("lastProcessedBlockHash")
        : null;

      try {
        const onchainBlock = await this.client.getBlock({ blockNumber: BigInt(forkBlock) });
        if (onchainBlock.hash && onchainBlock.hash === storedHashAtFork) {
          found = true;
          break;
        }
        // If we don't have per-block hashes stored, accept any block older
        // than 128 blocks as the fork point (reorgs deeper than that are
        // extremely unlikely).
        if (attempt > 64) {
          found = true;
          break;
        }
      } catch {
        // RPC error — skip this block, keep walking.
      }
      forkBlock--;
    }

    if (!found) {
      console.error("Reorg: could not locate fork point, resetting indexer from startBlock");
      const startBlock = Number(store.getState("startBlock") ?? 0);
      store.deleteAfterBlock(startBlock > 0 ? startBlock - 1 : 0);
      const block = await this.client.getBlock({ blockNumber: BigInt(Math.max(startBlock - 1, 0)) });
      store.setState("lastProcessedBlock", String(Math.max(startBlock - 1, 0)));
      store.setState("lastProcessedBlockHash", block.hash ?? "");
      return true;
    }

    console.warn(`Reorg: fork point found at block ${forkBlock}, rolling back events/snapshots past that block`);
    store.deleteAfterBlock(forkBlock);
    const block = await this.client.getBlock({ blockNumber: BigInt(forkBlock) });
    store.setState("lastProcessedBlock", String(forkBlock));
    store.setState("lastProcessedBlockHash", block.hash ?? "");
    return true;
  }

  private async sampleIfDue(): Promise<void> {
    const lastSample = store.getState("lastSampleTimestamp");
    const now = Math.floor(Date.now() / 1000);

    if (lastSample !== null && now - Number(lastSample) < this.config.sampleIntervalSec) {
      return;
    }

    const latestBlock = await this.client.getBlock();
    const blockNumber = Number(latestBlock.number ?? 0n);
    const blockTimestamp = Number(latestBlock.timestamp ?? BigInt(now));

    const mcResult = await this.client.multicall({
      allowFailure: true,
      contracts: [
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "totalAssets" },
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "totalSupply" },
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "assetsPerShare" },
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "getStrategies" },
      ],
    });

    // Bail if any core call failed
    if (mcResult.some((r) => r.status === "failure")) {
      console.warn("SampleIfDue: core multicall failed, skipping sample");
      return;
    }

    const totalAssets = mcResult[0].result as bigint;
    const totalSupply = mcResult[1].result as bigint;
    const assetsPerShare = mcResult[2].result as bigint;
    const strategies = mcResult[3].result as readonly `0x${string}`[];

    store.insertSnapshot({
      timestamp: blockTimestamp,
      block_number: blockNumber,
      total_assets: totalAssets.toString(),
      total_supply: totalSupply.toString(),
      assets_per_share: assetsPerShare.toString(),
    });

    if (strategies.length > 0) {
      const [configResults, assetResults] = await Promise.all([
        this.client.multicall({
          allowFailure: true,
          contracts: strategies.map((strategy) => ({
            address: this.config.vaultAddress,
            abi: blendedVaultAbi,
            functionName: "strategies",
            args: [strategy],
          })),
        }),
        this.client.multicall({
          allowFailure: true,
          contracts: strategies.map((strategy) => ({
            address: this.config.vaultAddress,
            abi: blendedVaultAbi,
            functionName: "strategyAssets",
            args: [strategy],
          })),
        }),
      ]);

      // Filter out failed results to prevent one bricked strategy from breaking the snapshot
      const allocationSnapshots = strategies
        .map((strategy, index) => {
          const configResult = configResults[index];
          const assetResult = assetResults[index];

          // Skip if either call failed
          if (configResult.status === "failure" || assetResult.status === "failure") {
            console.warn(`Skipping strategy ${strategy}: multicall failed`);
            return null;
          }

          const config = configResult.result as any as readonly [boolean, boolean, bigint, bigint, boolean];
          const assets = assetResult.result as any as bigint;

          return {
            timestamp: blockTimestamp,
            block_number: blockNumber,
            strategy,
            assets: assets.toString(),
            tier: Number(config[2]),
            cap_assets: config[3].toString(),
            enabled: config[1] ? 1 : 0,
            is_synchronous: config[4] ? 1 : 0,
          };
        })
        .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null);

      if (allocationSnapshots.length > 0) {
        store.insertAllocationSnapshots(allocationSnapshots);
      }

      // ── Strategy health metrics ──────────────────────────────────
      const prevHealth = store.getLatestStrategyHealth();
      const healthRows = allocationSnapshots.map((alloc) => {
        const assetsNum = Number(alloc.assets) / 1e6; // USDC decimals
        const capNum = Number(alloc.cap_assets) / 1e6;
        const utilization = capNum > 0 ? assetsNum / capNum : 0;

        // Share price delta vs previous health snapshot (bps)
        let sharePriceDeltaBps = 0;
        if (prevHealth) {
          const prev = prevHealth.strategies.find(
            (s) => s.strategy.toLowerCase() === alloc.strategy.toLowerCase()
          );
          if (prev) {
            const prevAssets = Number(prev.assets);
            if (prevAssets > 0) {
              sharePriceDeltaBps = Math.round(
                ((Number(alloc.assets) - prevAssets) / prevAssets) * 10000
              );
            }
          }
        }

        return {
          timestamp: blockTimestamp,
          block_number: blockNumber,
          strategy: alloc.strategy,
          assets: alloc.assets,
          max_withdraw: alloc.assets, // strategyAssets = max redeemable from BlendedVault's perspective
          utilization,
          share_price_delta_bps: sharePriceDeltaBps,
        };
      });

      store.insertStrategyHealth(healthRows);
    }

    store.setState("lastSampleTimestamp", String(blockTimestamp));
  }
}
