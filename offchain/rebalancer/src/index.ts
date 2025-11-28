import "dotenv/config";
import { formatUnits } from "viem";
import { vaultConfig } from "./config.js";
import { computeTargets } from "./optimizer.js";
import { fetchVaultState, fetchObservations, deriveObservations } from "./onchain.js";
import { buildReallocateCalldata } from "./executor.js";

async function main() {
  const vaultState = await fetchVaultState(vaultConfig.address as `0x${string}`);

  const strategyInputs = vaultConfig.strategies.map((s) => ({ address: s.address, targetApy: s.targetApy }));
  const observations =
    (await fetchObservations(strategyInputs).catch(() => undefined)) ||
    deriveObservations(vaultState.totalAssets);

  const plan = computeTargets(
    vaultConfig,
    observations,
    Number(formatUnits(vaultState.totalAssets, vaultState.assetDecimals))
  );
  const rebalance = buildReallocateCalldata(vaultConfig.address as `0x${string}`, vaultState.totalAssets, plan);

  console.log("Vault", vaultConfig.address);
  console.log("Chain", vaultConfig.chainId);
  console.log("Vault asset", vaultState.asset);
  console.log("Total assets", formatUnits(vaultState.totalAssets, vaultState.assetDecimals));
  console.log("Share price", vaultState.sharePrice);
  console.table(
    plan.map((item) => ({
      strategy: item.address,
      targetWeight: `${(item.targetWeight * 100).toFixed(2)}%`,
      rationale: item.rationale
    }))
  );
  console.log("Rebalance calldata (send with allocator signer):", rebalance);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
