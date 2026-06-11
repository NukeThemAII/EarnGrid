import type { Address, Hex, PublicClient } from "viem";
import { encodeFunctionData } from "viem";

import { blendedVaultAbi } from "./abi/blendedVault.js";
import type { StrategyAllocation, StrategyConfig, UserPosition, VaultQueues, VaultState } from "./types.js";

export { blendedVaultAbi };
export type { StrategyAllocation, StrategyConfig, UserPosition, VaultQueues, VaultState };

const tierMaxIndices = [0n, 1n, 2n] as const;
type StrategyConfigTuple = readonly [boolean, boolean, bigint, bigint, boolean];
type VaultStateTuple = readonly [
  Address,
  bigint,
  bigint,
  bigint,
  Address,
  bigint,
  boolean,
  boolean,
  bigint,
  bigint,
  bigint,
  bigint,
  number,
];
type RawContractCall = {
  address: Address;
  abi: typeof blendedVaultAbi;
  functionName: string;
  args?: readonly unknown[];
};
type RawPublicClient = {
  multicall(args: { allowFailure: false; contracts: readonly RawContractCall[] }): Promise<unknown>;
  readContract(args: RawContractCall): Promise<unknown>;
};

export async function getVaultState(
  client: PublicClient,
  vault: Address,
): Promise<VaultState> {
  const [
    asset,
    totalAssets,
    totalSupply,
    assetsPerShare,
    feeRecipient,
    highWatermarkAssetsPerShare,
    pausedDeposits,
    pausedWithdrawals,
    idleLiquidityBps,
    minInitialDeposit,
    minHarvestInterval,
    maxDailyIncreaseBps,
    decimals,
  ] = (await rawClient(client).multicall({
    allowFailure: false,
    contracts: [
      { address: vault, abi: blendedVaultAbi, functionName: "asset" },
      { address: vault, abi: blendedVaultAbi, functionName: "totalAssets" },
      { address: vault, abi: blendedVaultAbi, functionName: "totalSupply" },
      { address: vault, abi: blendedVaultAbi, functionName: "assetsPerShare" },
      { address: vault, abi: blendedVaultAbi, functionName: "feeRecipient" },
      {
        address: vault,
        abi: blendedVaultAbi,
        functionName: "highWatermarkAssetsPerShare",
      },
      { address: vault, abi: blendedVaultAbi, functionName: "pausedDeposits" },
      { address: vault, abi: blendedVaultAbi, functionName: "pausedWithdrawals" },
      { address: vault, abi: blendedVaultAbi, functionName: "idleLiquidityBps" },
      { address: vault, abi: blendedVaultAbi, functionName: "minInitialDeposit" },
      { address: vault, abi: blendedVaultAbi, functionName: "minHarvestInterval" },
      { address: vault, abi: blendedVaultAbi, functionName: "maxDailyIncreaseBps" },
      { address: vault, abi: blendedVaultAbi, functionName: "decimals" },
    ],
  })) as VaultStateTuple;

  const tierResults = await Promise.all(
    tierMaxIndices.map((index) => readTierMaxBps(client, vault, index)),
  );

  return {
    asset,
    totalAssets,
    totalSupply,
    assetsPerShare,
    feeRecipient,
    highWatermarkAssetsPerShare,
    pausedDeposits,
    pausedWithdrawals,
    idleLiquidityBps: Number(idleLiquidityBps),
    minInitialDeposit,
    minHarvestInterval,
    maxDailyIncreaseBps: Number(maxDailyIncreaseBps),
    tierMaxBps: [
      Number(tierResults[0]),
      Number(tierResults[1]),
      Number(tierResults[2]),
    ],
    decimals: Number(decimals),
  };
}

export async function getVaultQueues(
  client: PublicClient,
  vault: Address,
): Promise<VaultQueues> {
  const [depositQueue, withdrawQueue] = (await rawClient(client).multicall({
    allowFailure: false,
    contracts: [
      { address: vault, abi: blendedVaultAbi, functionName: "getDepositQueue" },
      { address: vault, abi: blendedVaultAbi, functionName: "getWithdrawQueue" },
    ],
  })) as readonly [readonly Address[], readonly Address[]];

  return { depositQueue: [...depositQueue], withdrawQueue: [...withdrawQueue] };
}

export async function getStrategies(
  client: PublicClient,
  vault: Address,
): Promise<Address[]> {
  const strategies = (await rawClient(client).readContract({
    address: vault,
    abi: blendedVaultAbi,
    functionName: "getStrategies",
  })) as readonly Address[];
  return [...strategies];
}

export async function getStrategyConfigs(
  client: PublicClient,
  vault: Address,
  strategies: Address[],
): Promise<StrategyConfig[]> {
  if (strategies.length === 0) {
    return [];
  }

  const configs = (await rawClient(client).multicall({
    allowFailure: false,
    contracts: strategies.map((strategy) => ({
      address: vault,
      abi: blendedVaultAbi,
      functionName: "strategies",
      args: [strategy],
    })),
  })) as readonly StrategyConfigTuple[];

  return configs.map(parseStrategyConfig);
}

export async function getAllocations(
  client: PublicClient,
  vault: Address,
): Promise<StrategyAllocation[]> {
  const strategies = await getStrategies(client, vault);
  if (strategies.length === 0) {
    return [];
  }

  const reader = rawClient(client);
  const configsPromise = reader.multicall({
    allowFailure: false,
    contracts: strategies.map((strategy) => ({
      address: vault,
      abi: blendedVaultAbi,
      functionName: "strategies",
      args: [strategy],
    })),
  }) as Promise<readonly StrategyConfigTuple[]>;
  const assetsPromise = reader.multicall({
    allowFailure: false,
    contracts: strategies.map((strategy) => ({
      address: vault,
      abi: blendedVaultAbi,
      functionName: "strategyAssets",
      args: [strategy],
    })),
  }) as Promise<readonly bigint[]>;
  const [configs, assets] = await Promise.all([configsPromise, assetsPromise]);

  return strategies.map((strategy, index) => ({
    strategy,
    assets: assets[index],
    ...parseStrategyConfig(configs[index]),
  }));
}

export async function getUserPosition(
  client: PublicClient,
  vault: Address,
  user: Address,
): Promise<UserPosition> {
  const [shares, maxWithdraw, maxRedeem] = (await rawClient(client).multicall({
    allowFailure: false,
    contracts: [
      { address: vault, abi: blendedVaultAbi, functionName: "balanceOf", args: [user] },
      { address: vault, abi: blendedVaultAbi, functionName: "maxWithdraw", args: [user] },
      { address: vault, abi: blendedVaultAbi, functionName: "maxRedeem", args: [user] },
    ],
  })) as readonly [bigint, bigint, bigint];

  return { shares, maxWithdraw, maxRedeem };
}

export function encodeDeposit(assets: bigint, receiver: Address): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "deposit",
    args: [assets, receiver],
  });
}

export function encodeMint(shares: bigint, receiver: Address): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "mint",
    args: [shares, receiver],
  });
}

export function encodeWithdraw(assets: bigint, receiver: Address, owner: Address): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "withdraw",
    args: [assets, receiver, owner],
  });
}

export function encodeRedeem(shares: bigint, receiver: Address, owner: Address): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "redeem",
    args: [shares, receiver, owner],
  });
}

export function encodeRebalance(
  withdrawStrategies: Address[],
  withdrawAmounts: bigint[],
  depositStrategies: Address[],
  depositAmounts: bigint[],
): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "rebalance",
    args: [withdrawStrategies, withdrawAmounts, depositStrategies, depositAmounts],
  });
}

export function encodeHarvest(): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "harvest",
    args: [],
  });
}

export function encodeSetDepositQueue(newQueue: Address[]): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "setDepositQueue",
    args: [newQueue],
  });
}

export function encodeSetWithdrawQueue(newQueue: Address[]): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "setWithdrawQueue",
    args: [newQueue],
  });
}

export function encodePauseDeposits(): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "pauseDeposits",
    args: [],
  });
}

export function encodeUnpauseDeposits(): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "unpauseDeposits",
    args: [],
  });
}

export function encodePauseWithdrawals(): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "pauseWithdrawals",
    args: [],
  });
}

export function encodeUnpauseWithdrawals(): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "unpauseWithdrawals",
    args: [],
  });
}

export function encodeSetCap(strategy: Address, newCap: bigint): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "setCap",
    args: [strategy, newCap],
  });
}

export function encodeScheduleCapIncrease(
  strategy: Address,
  newCap: bigint,
  salt: Hex,
): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "scheduleCapIncrease",
    args: [strategy, newCap, salt],
  });
}

export function encodeExecuteCapIncrease(
  strategy: Address,
  newCap: bigint,
  salt: Hex,
): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "executeCapIncrease",
    args: [strategy, newCap, salt],
  });
}

export function encodeScheduleAddStrategy(
  strategy: Address,
  tier: number,
  capAssets: bigint,
  isSynchronous: boolean,
  salt: Hex,
): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "scheduleAddStrategy",
    args: [strategy, tier, capAssets, isSynchronous, salt],
  });
}

export function encodeExecuteAddStrategy(
  strategy: Address,
  tier: number,
  capAssets: bigint,
  isSynchronous: boolean,
  salt: Hex,
): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "executeAddStrategy",
    args: [strategy, tier, capAssets, isSynchronous, salt],
  });
}

export function encodeSetTierMaxBps(newBps: [bigint, bigint, bigint]): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "setTierMaxBps",
    args: [newBps],
  });
}

export function encodeScheduleTierMaxBps(newBps: [bigint, bigint, bigint], salt: Hex): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "scheduleTierMaxBps",
    args: [newBps, salt],
  });
}

export function encodeExecuteTierMaxBps(newBps: [bigint, bigint, bigint], salt: Hex): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "executeTierMaxBps",
    args: [newBps, salt],
  });
}

export function encodeSetTimelockDelay(newDelay: bigint): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "setTimelockDelay",
    args: [newDelay],
  });
}

export function encodeScheduleTimelockDelay(newDelay: bigint, salt: Hex): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "scheduleTimelockDelay",
    args: [newDelay, salt],
  });
}

export function encodeExecuteTimelockDelay(newDelay: bigint, salt: Hex): Hex {
  return encodeFunctionData({
    abi: blendedVaultAbi,
    functionName: "executeTimelockDelay",
    args: [newDelay, salt],
  });
}

function parseStrategyConfig(
  config: StrategyConfigTuple,
): StrategyConfig {
  return {
    registered: config[0],
    enabled: config[1],
    tier: Number(config[2]),
    capAssets: config[3],
    isSynchronous: config[4],
  };
}

async function readTierMaxBps(
  client: PublicClient,
  vault: Address,
  index: bigint,
): Promise<bigint> {
  return (await rawClient(client).readContract({
    address: vault,
    abi: blendedVaultAbi,
    functionName: "tierMaxBps",
    args: [index],
  })) as bigint;
}

function rawClient(client: PublicClient): RawPublicClient {
  return client as unknown as RawPublicClient;
}
