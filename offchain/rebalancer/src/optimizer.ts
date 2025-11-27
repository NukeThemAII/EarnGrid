import { StrategyConfig, VaultConfig } from "./config";

export type StrategyObservation = {
  address: string;
  apy: number;
  tvl: number;
};

export type AllocationPlan = {
  address: string;
  targetWeight: number;
  rationale: string;
};

function sumMinWeights(strategies: StrategyConfig[]) {
  return strategies.reduce((acc, item) => acc + item.minWeight, 0);
}

export function computeTargets(config: VaultConfig, observations: StrategyObservation[]): AllocationPlan[] {
  const minWeightSum = sumMinWeights(config.strategies);
  const reservedForCash = config.cashBuffer;
  let remaining = Math.max(0, 1 - reservedForCash - minWeightSum);

  const plans: AllocationPlan[] = config.strategies.map((strategy) => ({
    address: strategy.address,
    targetWeight: strategy.minWeight,
    rationale: "Risk floor"
  }));

  const sorted = [...config.strategies].sort((a, b) => b.targetApy - a.targetApy);

  for (const strategy of sorted) {
    if (remaining <= 0) break;

    const current = plans.find((plan) => plan.address === strategy.address);
    if (!current) continue;

    const maxRoom = strategy.maxWeight - current.targetWeight;
    if (maxRoom <= 0) continue;

    const allocation = Math.min(maxRoom, remaining);
    current.targetWeight += allocation;
    current.rationale = current.rationale === "Risk floor" ? "Yield-weighted" : current.rationale;
    remaining -= allocation;
  }

  if (remaining > 0) {
    // Spread any residual evenly over conservative strategies.
    const conservative = plans.filter((plan) => {
      const meta = config.strategies.find((s) => s.address === plan.address);
      return meta?.risk === "conservative";
    });
    const delta = remaining / (conservative.length || 1);
    for (const plan of conservative) {
      plan.targetWeight += delta;
      plan.rationale = "Buffer";
    }
    remaining = 0;
  }

  // Clamp final weights to <=1 - cash buffer for readability.
  const totalPlanWeight = plans.reduce((acc, item) => acc + item.targetWeight, 0);
  if (totalPlanWeight > 1 - reservedForCash) {
    const scale = (1 - reservedForCash) / totalPlanWeight;
    for (const plan of plans) {
      plan.targetWeight *= scale;
      plan.rationale = "Scaled to fit cash buffer";
    }
  }

  // Re-inject any observed hard cap breaches into rationale.
  for (const plan of plans) {
    const obs = observations.find((item) => item.address === plan.address);
    if (!obs) continue;
    const configItem = config.strategies.find((item) => item.address === plan.address);
    if (!configItem) continue;
    const proposedValue = obs.tvl * (plan.targetWeight / Math.max(obs.tvl, 1));
    if (proposedValue > configItem.cap) {
      plan.rationale = "Cap limited";
    }
  }

  return plans;
}
