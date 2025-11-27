import "dotenv/config";
import { vaultConfig } from "./config";
import { computeTargets } from "./optimizer";
import { fetchVaultState, deriveObservations } from "./onchain";
import { buildReallocateCalldata } from "./executor";

async function main() {
  const vaultState = await fetchVaultState(vaultConfig.address as `0x${string}`);
  const observations = deriveObservations(vaultState.totalAssets);

  const plan = computeTargets(vaultConfig, observations);
  const rebalance = buildReallocateCalldata(vaultConfig.address as `0x${string}`, vaultState.totalAssets, plan);

  console.log("Vault", vaultConfig.address);
  console.log("Chain", vaultConfig.chainId);
  console.log("Vault asset", vaultState.asset);
  console.log("Total assets", vaultState.totalAssets.toString());
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
