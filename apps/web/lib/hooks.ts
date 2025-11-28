import { useReadContracts } from "wagmi";
import { earngridVaultAbi } from "./abi/earngridVault";
import { StrategyInfo } from "./vaults";
import { formatUnits } from "viem";

export function useStrategies(vaultAddress: `0x${string}`, strategies: StrategyInfo[], chainId: number) {
    // 1. Fetch Strategy Data from Vault (caps, allocation points)
    const vaultCalls = strategies.map((s) => ({
        address: vaultAddress,
        abi: earngridVaultAbi,
        functionName: "getStrategy",
        args: [s.address],
        chainId
    }));

    // 2. Fetch TVL from Strategy Contracts (totalAssets)
    const strategyCalls = strategies.map((s) => ({
        address: s.address as `0x${string}`,
        abi: earngridVaultAbi, // ERC4626 standard
        functionName: "totalAssets",
        chainId
    }));

    const { data: vaultData } = useReadContracts({
        contracts: vaultCalls,
        query: { enabled: !!vaultAddress && strategies.length > 0 }
    });

    const { data: strategyData } = useReadContracts({
        contracts: strategyCalls,
        query: { enabled: strategies.length > 0 }
    });

    // Merge data
    const mergedStrategies = strategies.map((s, i) => {
        const vData = vaultData?.[i]?.result as any; // StrategyData struct
        const sData = strategyData?.[i]?.result as bigint; // totalAssets

        const cap = vData ? Number(formatUnits(vData.cap, 6)) : s.cap; // Fallback to config if loading
        // Allocation is calculated as strategy.totalManagedAssets / vault.totalAssets in the contract, 
        // but here we might want to show target allocation or actual. 
        // Let's use actual TVL / Vault TVL for now in the UI if we had Vault TVL.
        // For now, let's just update TVL and Cap.

        const tvl = sData ? Number(formatUnits(sData, 6)) : s.tvl;

        return {
            ...s,
            cap,
            tvl
        };
    });

    return mergedStrategies;
}
