import {
  type Address,
  type Chain,
  type Hex,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import {
  blendedVaultAbi,
  encodeRebalance,
  encodeHarvest,
} from "@blended-vault/sdk";
import type { Config } from "./config.js";

// ---------------------------------------------------------------------------
// Executor: sends onchain transactions via viem
// ---------------------------------------------------------------------------

export interface Executor {
  readonly config: Config;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly account: PrivateKeyAccount;

  sendRebalance(
    withdrawStrategies: Address[],
    withdrawAmounts: bigint[],
    depositStrategies: Address[],
    depositAmounts: bigint[],
  ): Promise<Hex | null>;

  sendHarvest(): Promise<Hex | null>;
}

export function createExecutor(cfg: Config): Executor {
  const chain: Chain = cfg.chainId === baseSepolia.id ? baseSepolia : base;
  const transport = http(cfg.rpcUrl);
  const account: PrivateKeyAccount = privateKeyToAccount(cfg.privateKey);

  const publicClient: PublicClient = createPublicClient({
    chain,
    transport,
  }) as PublicClient;

  const walletClient: WalletClient = createWalletClient({
    chain,
    transport,
    account,
  }) as WalletClient;

  return {
    config: cfg,
    publicClient,
    walletClient,
    account,

    async sendRebalance(
      withdrawStrategies: Address[],
      withdrawAmounts: bigint[],
      depositStrategies: Address[],
      depositAmounts: bigint[],
    ): Promise<Hex | null> {
      const data: Hex = encodeRebalance(
        withdrawStrategies,
        withdrawAmounts,
        depositStrategies,
        depositAmounts,
      );

      if (cfg.dryRun) {
        console.log(
          JSON.stringify({
            level: "info",
            event: "dry_run_rebalance",
            vault: cfg.vaultAddress,
            withdrawStrategies,
            withdrawAmounts: withdrawAmounts.map((a: bigint) => a.toString()),
            depositStrategies,
            depositAmounts: depositAmounts.map((a: bigint) => a.toString()),
          }),
        );
        return null;
      }

      const gas = applyGasBump(
        await publicClient.estimateGas({
          account,
          to: cfg.vaultAddress,
          data,
        }),
        cfg.gasLimitBump,
      );

      const hash: Hex = await walletClient.sendTransaction({
        account,
        to: cfg.vaultAddress,
        data,
        chain,
        gas,
      });

      console.log(
        JSON.stringify({
          level: "info",
          event: "rebalance_sent",
          txHash: hash,
          vault: cfg.vaultAddress,
        }),
      );

      return hash;
    },

    async sendHarvest(): Promise<Hex | null> {
      const data: Hex = encodeHarvest();

      if (cfg.dryRun) {
        console.log(
          JSON.stringify({
            level: "info",
            event: "dry_run_harvest",
            vault: cfg.vaultAddress,
          }),
        );
        return null;
      }

      await publicClient.simulateContract({
        account,
        address: cfg.vaultAddress,
        abi: blendedVaultAbi,
        functionName: "harvest",
        args: [],
      });
      const gas = applyGasBump(
        await publicClient.estimateGas({
          account,
          to: cfg.vaultAddress,
          data,
        }),
        cfg.gasLimitBump,
      );

      const hash: Hex = await walletClient.sendTransaction({
        account,
        to: cfg.vaultAddress,
        data,
        chain,
        gas,
      });

      console.log(
        JSON.stringify({
          level: "info",
          event: "harvest_sent",
          txHash: hash,
          vault: cfg.vaultAddress,
        }),
      );

      return hash;
    },
  };
}

function applyGasBump(estimatedGas: bigint, bump: number): bigint {
  if (!Number.isFinite(bump) || bump <= 1) {
    return estimatedGas;
  }
  return (estimatedGas * BigInt(Math.ceil(bump * 100))) / 100n;
}
