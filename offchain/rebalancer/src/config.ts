export type StrategyConfig = {
  address: string;
  name: string;
  cap: number;
  risk: "conservative" | "moderate" | "growth";
  minWeight: number;
  maxWeight: number;
  targetApy: number;
};

export type VaultConfig = {
  address: string;
  chainId: number;
  cashBuffer: number;
  smearDuration: number;
  strategies: StrategyConfig[];
};

const envVault = process.env.VAULT_ADDRESS as `0x${string}` | undefined;

export const vaultConfig: VaultConfig = {
  address: envVault || ("0x000000000000000000000000000000000000dead" as const),
  chainId: Number(process.env.CHAIN_ID || 8453),
  cashBuffer: 0.08,
  smearDuration: 24 * 60 * 60,
  strategies: [
    {
      address: "0x0000000000000000000000000000000000000001",
      name: "Euler Earn EVK Core",
      cap: 6_000_000,
      risk: "conservative",
      minWeight: 0.2,
      maxWeight: 0.5,
      targetApy: 0.051
    },
    {
      address: "0x0000000000000000000000000000000000000002",
      name: "Morpho Gauntlet USDC Core",
      cap: 5_000_000,
      risk: "moderate",
      minWeight: 0.2,
      maxWeight: 0.45,
      targetApy: 0.079
    },
    {
      address: "0x0000000000000000000000000000000000000003",
      name: "MetaMorpho Dynamic Stables",
      cap: 3_500_000,
      risk: "growth",
      minWeight: 0.05,
      maxWeight: 0.25,
      targetApy: 0.105
    }
  ]
};
