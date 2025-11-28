import { describe, it } from "node:test";
import assert from "node:assert";
import { computeTargets, StrategyObservation } from "./optimizer.js";
import { VaultConfig } from "./config.js";

describe("Optimizer", () => {
    const mockConfig: VaultConfig = {
        address: "0xVault",
        chainId: 8453,
        cashBuffer: 0.1, // 10% cash buffer
        smearDuration: 0,
        strategies: [
            {
                address: "0xA",
                name: "Strategy A",
                cap: 1_000_000,
                risk: "conservative",
                minWeight: 0.1,
                maxWeight: 1.0,
                targetApy: 0.05
            },
            {
                address: "0xB",
                name: "Strategy B",
                cap: 1_000_000,
                risk: "growth",
                minWeight: 0.1,
                maxWeight: 1.0,
                targetApy: 0.10 // Higher APY
            }
        ]
    };

    it("should allocate remaining funds to highest APY strategy", () => {
        const observations: StrategyObservation[] = [
            { address: "0xA", apy: 0.05, tvl: 0 },
            { address: "0xB", apy: 0.10, tvl: 0 }
        ];
        const vaultTotalAssets = 100_000;

        const plans = computeTargets(mockConfig, observations, vaultTotalAssets);

        const planA = plans.find((p) => p.address === "0xA");
        const planB = plans.find((p) => p.address === "0xB");

        // Cash buffer 0.1 -> 0.9 remaining
        // Min weights: 0.1 + 0.1 = 0.2
        // Discretionary: 0.9 - 0.2 = 0.7
        // Strategy B has higher APY, should get all discretionary
        // Target A: 0.1
        // Target B: 0.1 + 0.7 = 0.8

        assert.ok(Math.abs(planA!.targetWeight - 0.1) < 0.0001, "Strategy A should have min weight");
        assert.ok(Math.abs(planB!.targetWeight - 0.8) < 0.0001, "Strategy B should have max weight");
    });

    it("should respect caps", () => {
        const cappedConfig = { ...mockConfig };
        cappedConfig.strategies[1].cap = 50_000; // Cap Strategy B at 50k

        const observations: StrategyObservation[] = [
            { address: "0xA", apy: 0.05, tvl: 0 },
            { address: "0xB", apy: 0.10, tvl: 0 }
        ];
        const vaultTotalAssets = 100_000;

        const plans = computeTargets(cappedConfig, observations, vaultTotalAssets);

        const planB = plans.find((p) => p.address === "0xB");
        // Max allocation for B = 50k / 100k = 0.5
        // It wanted 0.8, but capped at 0.5
        assert.ok(planB!.targetWeight <= 0.5001, "Strategy B should be capped");
        assert.equal(planB!.rationale, "Cap limited");
    });

    it("should handle zero vault assets", () => {
        const observations: StrategyObservation[] = [
            { address: "0xA", apy: 0.05, tvl: 0 },
            { address: "0xB", apy: 0.10, tvl: 0 }
        ];
        const vaultTotalAssets = 0;

        const plans = computeTargets(mockConfig, observations, vaultTotalAssets);

        // Should still produce valid weights summing to <= 1 - buffer
        const totalWeight = plans.reduce((sum, p) => sum + p.targetWeight, 0);
        assert.ok(totalWeight <= 0.9001);
    });
});
