import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address } from "viem";

import { buildRebalanceDecision } from "../src/rebalancer.js";
import type { StrategyAllocation, VaultState } from "@blended-vault/sdk";
import type { MorphoVaultWithApy } from "../src/types.js";

const VAULT = "0x0000000000000000000000000000000000000009" as Address;
const STRATEGY_A = "0x0000000000000000000000000000000000000001" as Address;
const STRATEGY_B = "0x0000000000000000000000000000000000000002" as Address;

describe("allocator rebalance planner", () => {
  it("uses Morpho decimal APY directly and prefers the higher APY strategy", () => {
    const decision = buildRebalanceDecision({
      allocations: [
        strategyAllocation(STRATEGY_A, 500n, 600n),
        strategyAllocation(STRATEGY_B, 500n, 600n),
      ],
      vaultState: vaultState(1_000n),
      vaultApys: [
        morphoApy(STRATEGY_A, 0.05),
        morphoApy(STRATEGY_B, 0.02),
      ],
      minDriftBps: 50,
    });

    assert.equal(decision.shouldRebalance, true);
    assert.deepEqual(decision.withdrawStrategies, [STRATEGY_B]);
    assert.deepEqual(decision.withdrawAmounts, [100n]);
    assert.deepEqual(decision.depositStrategies, [STRATEGY_A]);
    assert.deepEqual(decision.depositAmounts, [100n]);
    assert.equal(decision.targetAllocations[0].apyPct, 5);
  });

  it("leaves surplus idle instead of overflowing strategy caps", () => {
    const decision = buildRebalanceDecision({
      allocations: [
        strategyAllocation(STRATEGY_A, 500n, 400n),
        strategyAllocation(STRATEGY_B, 500n, 400n),
      ],
      vaultState: vaultState(1_000n),
      vaultApys: [
        morphoApy(STRATEGY_A, 0.06),
        morphoApy(STRATEGY_B, 0.04),
      ],
      minDriftBps: 50,
    });

    assert.equal(decision.shouldRebalance, true);
    assert.deepEqual(decision.withdrawStrategies, [STRATEGY_A, STRATEGY_B]);
    assert.deepEqual(decision.withdrawAmounts, [100n, 100n]);
    assert.deepEqual(decision.depositStrategies, []);
    assert.deepEqual(decision.depositAmounts, []);
    assert.equal(findTarget(decision, STRATEGY_A), 400n);
    assert.equal(findTarget(decision, STRATEGY_B), 400n);
  });

  it("can deploy idle liquidity while preserving the idle target", () => {
    const decision = buildRebalanceDecision({
      allocations: [
        strategyAllocation(STRATEGY_A, 300n, 700n),
        strategyAllocation(STRATEGY_B, 300n, 700n),
      ],
      vaultState: vaultState(1_000n, { idleLiquidityBps: 200 }),
      vaultApys: [
        morphoApy(STRATEGY_A, 0.05),
        morphoApy(STRATEGY_B, 0.02),
      ],
      minDriftBps: 50,
    });

    assert.equal(decision.shouldRebalance, true);
    assert.deepEqual(decision.withdrawStrategies, [STRATEGY_B]);
    assert.deepEqual(decision.withdrawAmounts, [20n]);
    assert.deepEqual(decision.depositStrategies, [STRATEGY_A]);
    assert.deepEqual(decision.depositAmounts, [400n]);
  });

  it("does not penalize a strategy when fresh APY data is missing", () => {
    const decision = buildRebalanceDecision({
      allocations: [
        strategyAllocation(STRATEGY_A, 100n, 1_000n),
        strategyAllocation(STRATEGY_B, 500n, 1_000n),
      ],
      vaultState: vaultState(1_000n),
      vaultApys: [morphoApy(STRATEGY_A, 0.05)],
      minDriftBps: 50,
    });

    assert.equal(decision.shouldRebalance, true);
    assert.equal(findTarget(decision, STRATEGY_B), 500n);
    assert.deepEqual(decision.depositStrategies, [STRATEGY_A]);
    assert.deepEqual(decision.depositAmounts, [400n]);
  });
});

function findTarget(decision: ReturnType<typeof buildRebalanceDecision>, strategy: Address): bigint {
  const target = decision.targetAllocations.find((allocation) => allocation.strategy === strategy);
  assert.ok(target);
  return target.targetAssets;
}

function strategyAllocation(
  strategy: Address,
  assets: bigint,
  capAssets: bigint,
  tier = 1,
): StrategyAllocation {
  return {
    strategy,
    assets,
    registered: true,
    enabled: true,
    tier,
    capAssets,
    isSynchronous: true,
  };
}

function vaultState(
  totalAssets: bigint,
  overrides: Partial<Pick<VaultState, "idleLiquidityBps" | "tierMaxBps">> = {},
): Pick<VaultState, "totalAssets" | "idleLiquidityBps" | "tierMaxBps"> {
  return {
    totalAssets,
    idleLiquidityBps: overrides.idleLiquidityBps ?? 0,
    tierMaxBps: overrides.tierMaxBps ?? [10_000, 10_000, 10_000],
  };
}

function morphoApy(strategy: Address, apyDecimal: number): MorphoVaultWithApy {
  return {
    address: strategy,
    name: strategy,
    symbol: "mUSDC",
    state: {
      netApy: apyDecimal,
      totalAssetsUsd: null,
    },
    apyDecimal,
  };
}
