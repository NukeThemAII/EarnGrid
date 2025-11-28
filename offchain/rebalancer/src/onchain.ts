import { type Hex, formatUnits } from "viem";
import { baseClient } from "./providers.js";
import { earngridVaultAbi } from "./abi/earngridVault.js";
import { erc4626Abi } from "./abi/erc4626.js";
import { erc20Abi } from "./abi/erc20.js";
import { StrategyObservation } from "./optimizer.js";

export type VaultState = {
  asset: Hex;
  totalAssets: bigint;
  totalSupply: bigint;
  sharePriceAtomic: bigint;
  sharePrice: string;
  assetDecimals: number;
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
  const sharePriceAtomic = supply === 0n ? 10n ** 18n : (assets * 10n ** 18n) / supply;
  const decimals = await baseClient.readContract({ address: assetAddress, abi: erc20Abi, functionName: "decimals" });

  return {
    asset: assetAddress,
    totalAssets: assets,
    totalSupply: supply,
    sharePriceAtomic,
    sharePrice: formatUnits(sharePriceAtomic, 18),
    assetDecimals: Number(decimals)
  };
}

export async function fetchObservations(strategies: { address: string; targetApy: number }[]): Promise<StrategyObservation[]> {
  if (strategies.length === 0) return [];

  const observations = await Promise.all(
    strategies.map(async (strategy) => {
      try {
        const asset = (await baseClient.readContract({
          address: strategy.address as Hex,
          abi: erc4626Abi,
          functionName: "asset"
        })) as Hex;

        const [totalAssets, decimals] = await Promise.all([
          baseClient.readContract({ address: strategy.address as Hex, abi: erc4626Abi, functionName: "totalAssets" }),
          baseClient
            .readContract({ address: asset, abi: erc20Abi, functionName: "decimals" })
            .catch(() => 6) // fallback for non-standard tokens
        ]);

        const tvl = Number(formatUnits(totalAssets as bigint, Number(decimals)));
        return { address: strategy.address, apy: strategy.targetApy, tvl };
      } catch {
        return { address: strategy.address, apy: strategy.targetApy, tvl: 0 };
      }
    })
  );

  return observations;
}
