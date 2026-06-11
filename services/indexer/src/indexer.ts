import type { PublicClient } from "viem";
import { decodeEventLog } from "viem";

import { blendedVaultAbi } from "./abi/blendedVault.js";
import type { DatabaseClient } from "./db.js";
import type { IndexerConfig } from "./config.js";
import {
  getLastProcessedBlock,
  getLastSampleTimestamp,
  insertAllocationSnapshots,
  insertEvent,
  insertSnapshot,
  recordLastProcessedBlock,
  recordLastSampleTimestamp,
  recordStartBlock,
} from "./queries.js";

export class VaultIndexer {
  private readonly client: PublicClient;
  private readonly db: DatabaseClient;
  private readonly config: IndexerConfig;
  private running = false;

  constructor(client: PublicClient, db: DatabaseClient, config: IndexerConfig) {
    this.client = client;
    this.db = db;
    this.config = config;
  }

  async init(): Promise<void> {
    const lastProcessed = await getLastProcessedBlock(this.db);
    if (lastProcessed !== null) {
      return;
    }

    const latestBlock = Number(await this.client.getBlockNumber());
    const startBlock = this.config.startBlock ?? latestBlock;

    await recordStartBlock(this.db, startBlock);
    // Record lastProcessedBlock as startBlock - 1 so syncEvents includes startBlock
    await recordLastProcessedBlock(this.db, Math.max(startBlock - 1, 0));
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
    const lastProcessed = await getLastProcessedBlock(this.db);
    if (lastProcessed === null) {
      return;
    }

    const latestBlock = Number(await this.client.getBlockNumber());
    const targetBlock = Math.max(latestBlock - this.config.finalityBlocks, 0);

    if (lastProcessed >= targetBlock) {
      return;
    }

    let fromBlock = lastProcessed + 1;
    while (fromBlock <= targetBlock) {
      const toBlock = Math.min(fromBlock + this.config.maxBlockRange - 1, targetBlock);
      const logs = await this.client.getLogs({
        address: this.config.vaultAddress,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      });

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: blendedVaultAbi,
            data: log.data,
            topics: log.topics,
          });
          const eventName = decoded.eventName;
          const eventData = stringifyBigints(decoded.args ?? {});

          await insertEvent(this.db, {
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

      await recordLastProcessedBlock(this.db, toBlock);
      fromBlock = toBlock + 1;
    }
  }

  private async sampleIfDue(): Promise<void> {
    const lastSample = await getLastSampleTimestamp(this.db);
    const now = Math.floor(Date.now() / 1000);

    if (lastSample !== null && now - lastSample < this.config.sampleIntervalSec) {
      return;
    }

    const latestBlock = await this.client.getBlock();
    const blockNumber = Number(latestBlock.number ?? 0n);
    const blockTimestamp = Number(latestBlock.timestamp ?? BigInt(now));

    const [totalAssets, totalSupply, assetsPerShare, strategies] = await this.client.multicall({
      allowFailure: false,
      contracts: [
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "totalAssets" },
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "totalSupply" },
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "assetsPerShare" },
        { address: this.config.vaultAddress, abi: blendedVaultAbi, functionName: "getStrategies" },
      ],
    });

    await insertSnapshot(this.db, {
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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const config = configResult.result as any as readonly [boolean, boolean, bigint, bigint, boolean];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        await insertAllocationSnapshots(this.db, allocationSnapshots);
      }
    }

    await recordLastSampleTimestamp(this.db, blockTimestamp);
  }
}

function stringifyBigints(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val));
}
