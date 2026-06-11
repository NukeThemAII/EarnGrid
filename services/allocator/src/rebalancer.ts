import { type Address, type PublicClient } from "viem";
import { getAllocations } from "@blended-vault/sdk";
import type {
  StrategyAllocation,
} from "@blended-vault/sdk";
import type { MorphoVaultWithApy } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TargetAllocation {
  strategy: Address;
  label: string;
  apyPct: number;
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
  enabled: boolean;
  registered: boolean;
  apyDecimal: number;
  score: number;
  currentPct: number;
}

function scoreStrategy(apyDecimal: number): number {
  return apyDecimal;
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
  // 1. Fetch current onchain allocations
  const currentAllocations: StrategyAllocation[] = await getAllocations(
    client,
    vaultAddress,
  );

  if (currentAllocations.length === 0) {
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

  const totalAssets: bigint =
    currentAllocations.reduce((sum: bigint, a: StrategyAllocation) => sum + a.assets, 0n) ?? 0n;
  const totalAssetsNum: number = Number(totalAssets);

  // 2. Build APY map by address
  const apyMap = new Map<string, number>();
  for (const apy of vaultApys) {
    apyMap.set(apy.address.toLowerCase(), apy.apyDecimal);
  }

  // 3. Score each enabled/registered strategy
  const scored: ScoredStrategy[] = currentAllocations
    .filter((a: StrategyAllocation) => a.enabled && a.registered)
    .map((alloc: StrategyAllocation) => {
      const addrLower = alloc.strategy.toLowerCase();
      const apyInfo: MorphoVaultWithApy | undefined = vaultApys.find(
        (v: MorphoVaultWithApy) => v.address.toLowerCase() === addrLower,
      );
      const apyDecimal: number = apyInfo?.apyDecimal ?? 0;

      const currentPct: number =
        totalAssetsNum > 0
          ? (Number(alloc.assets) / totalAssetsNum) * 100
          : 0;

      return {
        strategy: alloc.strategy,
        tier: alloc.tier,
        capAssets: alloc.capAssets,
        assets: alloc.assets,
        enabled: alloc.enabled,
        registered: alloc.registered,
        apyDecimal,
        score: scoreStrategy(apyDecimal),
        currentPct,
      };
    });

  // Sort by score descending
  scored.sort((a: ScoredStrategy, b: ScoredStrategy) => b.score - a.score);

  // 4. Compute target allocation
  // Simple heuristic: allocate to best strategy within cap/tier limits
  const targetPcts: Record<string, number> = {};
  let remainingPct = 100;

  for (const s of scored) {
    if (remainingPct <= 0) {
      targetPcts[s.strategy.toLowerCase()] = 0;
      continue;
    }

    // Cap constraint: what % does the cap allow?
    const capPct: number =
      totalAssetsNum > 0
        ? (Number(s.capAssets) / totalAssetsNum) * 100
        : 100;

    // Tier limit heuristic: tier 0 = 100%, tier 1 = 50%, tier 2 = 25%
    const tierMaxPct: number = s.tier === 0 ? 100 : s.tier === 1 ? 50 : 25;

    // Effective max for this strategy
    const maxForThis: number = Math.min(capPct, tierMaxPct, remainingPct);
    targetPcts[s.strategy.toLowerCase()] = Math.max(0, maxForThis);
    remainingPct -= maxForThis;

    // Rounding adjustment: dump remaining into first strategy
    if (s === scored[0] && remainingPct > 0) {
      targetPcts[s.strategy.toLowerCase()] += remainingPct;
      remainingPct = 0;
    }
  }

  // 5. Detect changes exceeding threshold
  const deltas: TargetAllocation[] = scored.map((s: ScoredStrategy) => {
    const addrLower = s.strategy.toLowerCase();
    const targetPct = targetPcts[addrLower] ?? 0;
    return {
      strategy: s.strategy,
      label: s.strategy.slice(0, 10),
      apyPct: s.apyDecimal * 100,
      currentPct: s.currentPct,
      targetPct,
    };
  });

  const minImprovementDecimal = minImprovementBps / 10_000;
  const significantChanges = deltas.filter(
    (d: TargetAllocation) =>
      Math.abs(d.targetPct - d.currentPct) > minImprovementDecimal * 100,
  );

  if (significantChanges.length === 0) {
    return {
      shouldRebalance: false,
      reason: `No significant allocation change needed (threshold: ${(minImprovementDecimal * 100).toFixed(2)}%)`,
      withdrawStrategies: [],
      withdrawAmounts: [],
      depositStrategies: [],
      depositAmounts: [],
      targetAllocations: deltas,
      currentAllocations: Object.fromEntries(
        scored.map((s: ScoredStrategy) => [s.strategy.toLowerCase(), s.currentPct]),
      ),
    };
  }

  // 6. Build rebalance tx data
  const withdrawStrategies: Address[] = [];
  const withdrawAmounts: bigint[] = [];
  const depositStrategies: Address[] = [];
  const depositAmounts: bigint[] = [];

  for (const s of scored) {
    const addrLower = s.strategy.toLowerCase();
    const targetPct = targetPcts[addrLower] ?? 0;
    const targetAssets = BigInt(Math.floor((targetPct / 100) * totalAssetsNum));

    if (targetAssets < s.assets) {
      const diff = s.assets - targetAssets;
      if (diff > 0n) {
        withdrawStrategies.push(s.strategy);
        withdrawAmounts.push(diff);
      }
    } else if (targetAssets > s.assets) {
      const diff = targetAssets - s.assets;
      if (diff > 0n) {
        depositStrategies.push(s.strategy);
        depositAmounts.push(diff);
      }
    }
  }

  // Verify conservation
  const totalWithdraw = withdrawAmounts.reduce((a: bigint, b: bigint) => a + b, 0n);
  const totalDeposit = depositAmounts.reduce((a: bigint, b: bigint) => a + b, 0n);

  if (totalWithdraw !== totalDeposit) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "rebalance_imbalance",
        totalWithdraw: totalWithdraw.toString(),
        totalDeposit: totalDeposit.toString(),
      }),
    );
  }

  return {
    shouldRebalance: true,
    reason: `Rebalance triggered: ${significantChanges.length} strategies exceed ${(minImprovementDecimal * 100).toFixed(2)}% improvement threshold`,
    withdrawStrategies,
    withdrawAmounts,
    depositStrategies,
    depositAmounts,
    targetAllocations: deltas,
    currentAllocations: Object.fromEntries(
      scored.map((s: ScoredStrategy) => [s.strategy.toLowerCase(), s.currentPct]),
    ),
  };
}
