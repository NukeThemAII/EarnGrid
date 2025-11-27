import { type Hex, formatUnits } from "viem";
import { baseClient } from "./providers";
import { earngridVaultAbi } from "./abi/earngridVault";
import { StrategyObservation } from "./optimizer";
import { vaultConfig } from "./config";

export type VaultState = {
  asset: Hex;
  totalAssets: bigint;
  totalSupply: bigint;
  sharePrice: number;
};

export async function fetchVaultState(vaultAddress: Hex): Promise<VaultState> {
  const [asset, totalAssets, totalSupply] = await baseClient.multicall({
    contracts: [
      { address: vaultAddress, abi: earngridVaultAbi, functionName: "asset" },
      { address: vaultAddress, abi: earngridVaultAbi, functionName: "totalAssets" },
      { address: vaultAddress, abi: earngridVaultAbi, functionName: "totalSupply" }
    ]
  });

  const assetAddress = (asset.result ?? "0x0000000000000000000000000000000000000000") as Hex;
  const assets = (totalAssets.result ?? 0n) as bigint;
  const supply = (totalSupply.result ?? 0n) as bigint;
  const sharePrice = supply === 0n ? 1 : Number(assets) / Number(supply);

  return {
    asset: assetAddress,
    totalAssets: assets,
    totalSupply: supply,
    sharePrice
  };
}

/// @notice Placeholder observation aggregator; replace with live strategy reads once wired.
export function deriveObservations(totalAssets: bigint): StrategyObservation[] {
  const totalNumeric = Number(formatUnits(totalAssets, 6));
  const perStrategy = totalNumeric / Math.max(vaultConfig.strategies.length, 1);

  return vaultConfig.strategies.map((strategy) => ({
    address: strategy.address as Hex,
    apy: strategy.targetApy,
    tvl: perStrategy
  }));
}
