import "dotenv/config";
import { createPublicClient, formatUnits, http } from "viem";
import { base } from "viem/chains";
import { earngridVaultAbi } from "./abi/earngridVault";
import { erc20Abi } from "./abi/erc20";

const rpcUrl = process.env.BASE_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/demo";
const vaultAddress = (process.env.VAULT_ADDRESS ||
  "0x000000000000000000000000000000000000dead") as `0x${string}`;

async function main() {
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl)
  });

  const [asset, totalAssets, totalSupply] = await client.multicall({
    contracts: [
      { address: vaultAddress, abi: earngridVaultAbi, functionName: "asset" },
      { address: vaultAddress, abi: earngridVaultAbi, functionName: "totalAssets" },
      { address: vaultAddress, abi: earngridVaultAbi, functionName: "totalSupply" }
    ]
  });

  const assetAddress = (asset.result ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const decimals = await client.readContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: "decimals"
  });

  const totalAssetsValue = (totalAssets.result ?? 0n) as bigint;
  const totalSupplyValue = (totalSupply.result ?? 0n) as bigint;
  const sharePriceAtomic = totalSupplyValue === 0n ? 1_000_000_000_000_000_000n : (totalAssetsValue * 1_000_000_000_000_000_000n) / totalSupplyValue;
  const sharePrice = formatUnits(sharePriceAtomic, 18);

  console.log("Vault", vaultAddress);
  console.log("RPC", rpcUrl);
  console.log("Asset", assetAddress);
  console.log("Total assets", formatUnits(totalAssetsValue, decimals));
  console.log("Total supply", totalSupplyValue.toString());
  console.log("Share price", sharePrice);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
