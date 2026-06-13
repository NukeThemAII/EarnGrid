import type { PublicClient } from "viem";
import { decodeEventLog } from "viem";

import { blendedVaultAbi } from "./abi/blendedVault.js";
import type { IndexerConfig } from "./config.js";
import * as store from "./db.js";

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

    const latestBlock = Number(await this.client.getBlockNumber());
    const targetBlock = Math.max(latestBlock - this.config.finalityBlocks, 0);

    if (Number(lastProcessed) >= targetBlock) {
      return;
    }

    let fromBlock = Number(lastProcessed) + 1;
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
      fromBlock = toBlock + 1;
    }
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
    }

    store.setState("lastSampleTimestamp", String(blockTimestamp));
  }
}
