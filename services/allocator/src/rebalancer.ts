import { type Address, type PublicClient } from "viem";
import { getAllocations, getVaultState } from "@blended-vault/sdk";
import type {
  StrategyAllocation,
  VaultState,
} from "@blended-vault/sdk";
import type { MorphoVaultWithApy } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TargetAllocation {
  strategy: Address;
  label: string;
  apyPct: number;
  currentAssets: bigint;
  targetAssets: bigint;
  targetPct: number;
  currentPct: number;
}

export interface AllocatorDecision {
  /** Whether a rebalance is needed */
  shouldRebalance: boolean;
  /** Reason / summary string for logging */
  reason: string;
  /** Strategies to withdraw from (addresses) */
  withdrawStrategies: Address[];
  /** Amounts to withdraw (raw bigint) */
  withdrawAmounts: bigint[];
  /** Strategies to deposit into (addresses) */
  depositStrategies: Address[];
  /** Amounts to deposit (raw bigint) */
  depositAmounts: bigint[];
  /** Target allocation breakdown for logging */
  targetAllocations: TargetAllocation[];
  /** Current allocation % by strategy address */
  currentAllocations: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Scored strategy entry */
interface ScoredStrategy {
  strategy: Address;
  tier: number;
  capAssets: bigint;
  assets: bigint;
  apyDecimal: number;
  hasApy: boolean;
  score: number;
  currentPct: number;
}

function scoreStrategy(apyDecimal: number): number {
  return apyDecimal;
}

export interface RebalanceInputs {
  allocations: StrategyAllocation[];
  vaultState: Pick<VaultState, "totalAssets" | "idleLiquidityBps" | "tierMaxBps">;
  vaultApys: MorphoVaultWithApy[];
  minDriftBps: number;
}

// ---------------------------------------------------------------------------
// Main decision logic
// ---------------------------------------------------------------------------

/**
 * Analyze vault state and MetaMorpho APY data, decide if a rebalance is
 * warranted, and if so, compute the rebalance amounts.
 */
export async function evaluateRebalance(
  client: PublicClient,
  vaultAddress: Address,
  vaultApys: MorphoVaultWithApy[],
  minImprovementBps: number,
): Promise<AllocatorDecision> {
  const [allocations, vaultState] = await Promise.all([
    getAllocations(client, vaultAddress),
    getVaultState(client, vaultAddress),
  ]);

  return buildRebalanceDecision({
    allocations,
    vaultState,
    vaultApys,
    minDriftBps: minImprovementBps,
  });
}

export function buildRebalanceDecision({
  allocations,
  vaultState,
  vaultApys,
  minDriftBps,
}: RebalanceInputs): AllocatorDecision {
  if (allocations.length === 0) {
    return {
      shouldRebalance: false,
      reason: "No strategies configured in vault",
      withdrawStrategies: [],
      withdrawAmounts: [],
      depositStrategies: [],
      depositAmounts: [],
      targetAllocations: [],
      currentAllocations: {},
    };
  }

  const totalAssets = vaultState.totalAssets;
  const strategyAssets = allocations.reduce((sum, allocation) => sum + allocation.assets, 0n);
  const idleAssets = totalAssets > strategyAssets ? totalAssets - strategyAssets : 0n;
  const idleTarget = bpsOf(totalAssets, BigInt(vaultState.idleLiquidityBps));
  const idleAvailable = idleAssets > idleTarget ? idleAssets - idleTarget : 0n;
  const investableAssets = totalAssets > idleTarget ? totalAssets - idleTarget : 0n;

  const apyMap = new Map<string, number>();
  for (const apy of vaultApys) {
    apyMap.set(apy.address.toLowerCase(), apy.apyDecimal);
  }

  const targetAssets = new Map<string, bigint>();
  for (const allocation of allocations) {
    targetAssets.set(allocation.strategy.toLowerCase(), 0n);
  }

  const eligible = allocations.filter(
    (allocation) => allocation.registered && allocation.enabled && allocation.isSynchronous,
  );
  const known: ScoredStrategy[] = [];
  const tierTargetExposure: bigint[] = [0n, 0n, 0n];
  let reservedForMissingApy = 0n;

  for (const allocation of eligible) {
    const key = allocation.strategy.toLowerCase();
    const apyDecimal = apyMap.get(key);
    const currentPct = percentage(allocation.assets, totalAssets);

    if (apyDecimal === undefined) {
      const preserved = clampToCap(allocation.assets, allocation.capAssets);
      targetAssets.set(key, preserved);
      reservedForMissingApy += preserved;
      tierTargetExposure[allocation.tier] += preserved;
      continue;
    }

    known.push({
      strategy: allocation.strategy,
      tier: allocation.tier,
      capAssets: allocation.capAssets,
      assets: allocation.assets,
      apyDecimal,
      hasApy: true,
      score: scoreStrategy(apyDecimal),
      currentPct,
    });
  }

  known.sort((a, b) => b.score - a.score);

  if (known.length === 0) {
    return {
      shouldRebalance: false,
      reason: "No fresh APY data for enabled synchronous strategies",
      withdrawStrategies: [],
      withdrawAmounts: [],
      depositStrategies: [],
      depositAmounts: [],
      targetAllocations: buildTargetAllocations(allocations, targetAssets, apyMap, totalAssets),
      currentAllocations: buildCurrentAllocationMap(allocations, totalAssets),
    };
  }

  let remainingBudget = investableAssets > reservedForMissingApy
    ? investableAssets - reservedForMissingApy
    : 0n;

  for (const strategy of known) {
    if (remainingBudget === 0n) {
      targetAssets.set(strategy.strategy.toLowerCase(), 0n);
      continue;
    }

    const tierLimit = bpsOf(
      totalAssets,
      BigInt(vaultState.tierMaxBps[strategy.tier] ?? 0),
    );
    const tierRemaining = tierLimit > tierTargetExposure[strategy.tier]
      ? tierLimit - tierTargetExposure[strategy.tier]
      : 0n;
    const target = minBigInt(strategy.capAssets, tierRemaining, remainingBudget);

    targetAssets.set(strategy.strategy.toLowerCase(), target);
    tierTargetExposure[strategy.tier] += target;
    remainingBudget -= target;
  }

  const deltas = buildTargetAllocations(allocations, targetAssets, apyMap, totalAssets);
  const significantChanges = deltas.filter(
    (delta) => absDiff(delta.targetAssets, delta.currentAssets) > bpsOf(totalAssets, BigInt(minDriftBps)),
  );

  if (significantChanges.length === 0) {
    return {
      shouldRebalance: false,
      reason: `No significant allocation change needed (threshold: ${(minDriftBps / 100).toFixed(2)}%)`,
      withdrawStrategies: [],
      withdrawAmounts: [],
      depositStrategies: [],
      depositAmounts: [],
      targetAllocations: deltas,
      currentAllocations: buildCurrentAllocationMap(allocations, totalAssets),
    };
  }

  const withdrawStrategies: Address[] = [];
  const withdrawAmounts: bigint[] = [];
  const depositStrategies: Address[] = [];
  const depositAmounts: bigint[] = [];

  for (const allocation of allocations) {
    const target = targetAssets.get(allocation.strategy.toLowerCase()) ?? 0n;

    if (target < allocation.assets) {
      const diff = allocation.assets - target;
      if (diff > 0n) {
        withdrawStrategies.push(allocation.strategy);
        withdrawAmounts.push(diff);
      }
    } else if (target > allocation.assets) {
      const diff = target - allocation.assets;
      if (diff > 0n) {
        depositStrategies.push(allocation.strategy);
        depositAmounts.push(diff);
      }
    }
  }

  const totalWithdraw = sumBigInts(withdrawAmounts);
  const totalDeposit = sumBigInts(depositAmounts);
  const availableToDeposit = totalWithdraw + idleAvailable;

  if (totalDeposit > availableToDeposit) {
    return {
      shouldRebalance: false,
      reason: "Computed deposits exceed withdrawn plus deployable idle liquidity",
      withdrawStrategies: [],
      withdrawAmounts: [],
      depositStrategies: [],
      depositAmounts: [],
      targetAllocations: deltas,
      currentAllocations: buildCurrentAllocationMap(allocations, totalAssets),
    };
  }

  return {
    shouldRebalance: true,
    reason: `Rebalance triggered: ${significantChanges.length} strategies exceed ${(minDriftBps / 100).toFixed(2)}% allocation drift threshold`,
    withdrawStrategies,
    withdrawAmounts,
    depositStrategies,
    depositAmounts,
    targetAllocations: deltas,
    currentAllocations: buildCurrentAllocationMap(allocations, totalAssets),
  };
}

function buildTargetAllocations(
  allocations: StrategyAllocation[],
  targetAssets: Map<string, bigint>,
  apyMap: Map<string, number>,
  totalAssets: bigint,
): TargetAllocation[] {
  return allocations.map((allocation) => {
    const key = allocation.strategy.toLowerCase();
    const target = targetAssets.get(key) ?? 0n;
    const apyDecimal = apyMap.get(key) ?? 0;

    return {
      strategy: allocation.strategy,
      label: allocation.strategy.slice(0, 10),
      apyPct: apyDecimal * 100,
      currentAssets: allocation.assets,
      targetAssets: target,
      currentPct: percentage(allocation.assets, totalAssets),
      targetPct: percentage(target, totalAssets),
    };
  });
}

function buildCurrentAllocationMap(
  allocations: StrategyAllocation[],
  totalAssets: bigint,
): Record<string, number> {
  return Object.fromEntries(
    allocations.map((allocation) => [
      allocation.strategy.toLowerCase(),
      percentage(allocation.assets, totalAssets),
    ]),
  );
}

function bpsOf(value: bigint, bps: bigint): bigint {
  return (value * bps) / 10_000n;
}

function percentage(value: bigint, total: bigint): number {
  if (total === 0n) {
    return 0;
  }
  return Number((value * 1_000_000n) / total) / 10_000;
}

function minBigInt(...values: bigint[]): bigint {
  return values.reduce((min, value) => (value < min ? value : min));
}

function sumBigInts(values: bigint[]): bigint {
  return values.reduce((sum, value) => sum + value, 0n);
}

function absDiff(a: bigint, b: bigint): bigint {
  return a > b ? a - b : b - a;
}

function clampToCap(value: bigint, cap: bigint): bigint {
  return value > cap ? cap : value;
}
