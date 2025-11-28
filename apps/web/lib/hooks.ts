import { useReadContracts } from "wagmi";
import { earngridVaultAbi } from "./abi/earngridVault";
import { erc4626Abi } from "./abi/erc4626";
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
    abi: erc4626Abi, // ERC4626 standard
    functionName: "totalAssets",
    chainId
  }));

  // 3. Fetch Queues (Supply & Withdraw)
  // We fetch a fixed number of slots (e.g., 10) to cover reasonable queue lengths
  const queueSlots = Array.from({ length: 10 }, (_, i) => i);
  const supplyQueueCalls = queueSlots.map((i) => ({
    address: vaultAddress,
    abi: earngridVaultAbi,
    functionName: "supplyQueue",
    args: [BigInt(i)],
    chainId
  }));
  const withdrawQueueCalls = queueSlots.map((i) => ({
    address: vaultAddress,
    abi: earngridVaultAbi,
    functionName: "withdrawQueue",
    args: [BigInt(i)],
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

  const { data: supplyQueueData } = useReadContracts({
    contracts: supplyQueueCalls,
    query: { enabled: !!vaultAddress }
  });

  const { data: withdrawQueueData } = useReadContracts({
    contracts: withdrawQueueCalls,
    query: { enabled: !!vaultAddress }
  });

  // Process Queues
  const supplyQueue = supplyQueueData?.map((d) => d.result as string | undefined).filter(Boolean) || [];
  const withdrawQueue = withdrawQueueData?.map((d) => d.result as string | undefined).filter(Boolean) || [];

  // Merge data
  const mergedStrategies = strategies.map((s, i) => {
    const vData = vaultData?.[i]?.result as any; // StrategyData struct
    const sData = strategyData?.[i]?.result as bigint; // totalAssets

    const cap = vData ? Number(formatUnits(vData.cap, 6)) : s.cap; // Fallback to config if loading
    const tvl = sData ? Number(formatUnits(sData, 6)) : s.tvl;

    // Determine queue positions (1-based index, or null if not in queue)
    const supplyIndex = supplyQueue.findIndex((addr) => addr?.toLowerCase() === s.address.toLowerCase());
    const withdrawIndex = withdrawQueue.findIndex((addr) => addr?.toLowerCase() === s.address.toLowerCase());

    return {
      ...s,
      cap,
      tvl,
      supplyRank: supplyIndex !== -1 ? supplyIndex + 1 : null,
      withdrawRank: withdrawIndex !== -1 ? withdrawIndex + 1 : null
    };
  });

  return mergedStrategies;
}
