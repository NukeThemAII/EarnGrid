import { Hex, encodeFunctionData } from "viem";
import { earngridVaultAbi } from "./abi/earngridVault";
import { AllocationPlan } from "./optimizer";

export type RebalanceCall = {
  to: Hex;
  data: Hex;
  value: bigint;
};

function weightToBps(weight: number): bigint {
  const scaled = Math.round(weight * 1_000_000);
  return BigInt(scaled);
}

/// @notice Build calldata for `reallocate` (EulerEarn signature) using target weights and current total assets.
export function buildReallocateCalldata(vault: Hex, totalAssets: bigint, plans: AllocationPlan[]): RebalanceCall {
  const assets = plans.map((plan) => {
    const bps = weightToBps(plan.targetWeight);
    const allocated = (totalAssets * bps) / 1_000_000n;
    return { id: plan.address, assets: allocated };
  });

  const data = encodeFunctionData({
    abi: [
      {
        name: "reallocate",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          {
            name: "allocations",
            type: "tuple[]",
            components: [
              { name: "id", type: "address" },
              { name: "assets", type: "uint256" }
            ]
          }
        ],
        outputs: []
      }
    ],
    functionName: "reallocate",
    args: [assets]
  });

  return {
    to: vault,
    data,
    value: 0n
  };
}
