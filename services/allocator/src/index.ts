import "dotenv/config";
import { loadConfig, type Config } from "./config.js";
import { createExecutor, type Executor } from "./executor.js";
import { fetchMetaMorphoVaultApys } from "./morpho.js";
import { evaluateRebalance } from "./rebalancer.js";
import { getAllocations, getVaultState } from "@blended-vault/sdk";
import { METAMORPHO_VAULT_NAMES } from "./types.js";
import type { Address } from "viem";

// ---------------------------------------------------------------------------
// Allocator Keeper Bot
// ---------------------------------------------------------------------------

let lastHarvestTime = 0;

async function main(): Promise<void> {
  const config: Config = loadConfig();

  console.log(
    JSON.stringify({
      level: "info",
      event: "startup",
      vault: config.vaultAddress,
      pollIntervalMs: config.pollIntervalMs,
      harvestIntervalMs: config.harvestIntervalMs,
      minApyImprovementBps: config.minApyImprovementBps,
      dryRun: config.dryRun,
      chainId: config.chainId,
    }),
  );

  const executor: Executor = createExecutor(config);

  // Run the tick immediately, then every pollIntervalMs
  await tick(config, executor);
  setInterval(() => {
    tick(config, executor).catch((err: Error) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "tick_error",
          error: err.message,
        }),
      );
    });
  }, config.pollIntervalMs);
}

async function tick(config: Config, executor: Executor): Promise<void> {
  const now = Date.now();

  console.log(
    JSON.stringify({
      level: "info",
      event: "tick_start",
      timestamp: new Date().toISOString(),
    }),
  );

  try {
    // 1. Fetch current vault state (strategies configured in the vault)
    const vaultState = await getVaultState(executor.publicClient, config.vaultAddress);
    const allocations = await getAllocations(executor.publicClient, config.vaultAddress);

    const enabledStrategies: Address[] = allocations
      .filter((a) => a.enabled && a.registered)
      .map((a) => a.strategy);

    if (enabledStrategies.length === 0) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "no_strategies",
          msg: "No enabled strategies found in vault",
        }),
      );
      return;
    }

    // 2. Fetch APY data from Morpho Blue GraphQL for our strategies
    const vaultApys = await fetchMetaMorphoVaultApys(
      config.morphoApiUrl,
      enabledStrategies,
    );

    // Log APYs we received
    for (const v of vaultApys) {
      const label = METAMORPHO_VAULT_NAMES[v.address.toLowerCase()] ?? v.address.slice(0, 10);
      console.log(
        JSON.stringify({
          level: "info",
          event: "strategy_apy",
          strategy: v.address,
          label,
          netApy: v.state.netApy,
          apyPercent: (v.apyDecimal * 100).toFixed(2),
          totalAssetsUsd: v.state.totalAssetsUsd,
        }),
      );
    }

    // 3. Evaluate if rebalance is needed
    const decision = await evaluateRebalance(
      executor.publicClient,
      config.vaultAddress,
      vaultApys,
      config.minApyImprovementBps,
    );

    // Log current vs target allocation
    for (const alloc of decision.targetAllocations) {
      console.log(
        JSON.stringify({
          level: "info",
          event: "allocation_status",
          strategy: alloc.strategy,
          label: alloc.label,
          apyPct: alloc.apyPct.toFixed(2),
          currentPct: alloc.currentPct.toFixed(2),
          targetPct: alloc.targetPct.toFixed(2),
        }),
      );
    }

    // 4. Execute rebalance if needed
    if (decision.shouldRebalance) {
      console.log(
        JSON.stringify({
          level: "info",
          event: "rebalancing",
          reason: decision.reason,
          withdrawCount: decision.withdrawStrategies.length,
          depositCount: decision.depositStrategies.length,
        }),
      );

      const txHash = await executor.sendRebalance(
        decision.withdrawStrategies,
        decision.withdrawAmounts,
        decision.depositStrategies,
        decision.depositAmounts,
      );

      if (txHash) {
        console.log(
          JSON.stringify({
            level: "info",
            event: "rebalance_complete",
            txHash,
          }),
        );
      }
    } else {
      console.log(
        JSON.stringify({
          level: "info",
          event: "no_rebalance_needed",
          reason: decision.reason,
        }),
      );
    }

    // 5. Harvest periodically
    const shouldHarvest =
      lastHarvestTime === 0 ||
      now - lastHarvestTime >= config.harvestIntervalMs;

    if (shouldHarvest) {
      console.log(
        JSON.stringify({
          level: "info",
          event: "harvesting",
        }),
      );

      const harvestHash = await executor.sendHarvest();

      if (harvestHash) {
        lastHarvestTime = now;
        console.log(
          JSON.stringify({
            level: "info",
            event: "harvest_complete",
            txHash: harvestHash,
          }),
        );
      } else if (config.dryRun) {
        lastHarvestTime = now;
      }
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "tick_end",
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: "error",
        event: "tick_error",
        error: message,
      }),
    );
  }
}

main().catch((err: Error) => {
  console.error(
    JSON.stringify({
      level: "fatal",
      event: "startup_error",
      error: err.message,
      stack: err.stack,
    }),
  );
  process.exit(1);
});
