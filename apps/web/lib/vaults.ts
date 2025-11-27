export type StrategyInfo = {
  name: string;
  address: string;
  risk: "conservative" | "moderate" | "growth";
  apy: number;
  cap: number;
  allocation: number;
  tvl: number;
};

export type VaultOverview = {
  name: string;
  symbol: string;
  address: string;
  chainId: number;
  apy: number;
  tvl: number;
  sharePrice: number;
  smearDuration: number;
  cashBuffer: number;
  strategies: StrategyInfo[];
};

export const primaryVault: VaultOverview = {
  name: "EarnGrid USDC",
  symbol: "egUSDC",
  address: "0x000000000000000000000000000000000000dead",
  chainId: 8453,
  apy: 0.068,
  tvl: 12_500_000,
  sharePrice: 1.0234,
  smearDuration: 24 * 60 * 60,
  cashBuffer: 0.08,
  strategies: [
    {
      name: "Euler Earn EVK Core",
      address: "0x0000000000000000000000000000000000000001",
      risk: "conservative",
      apy: 0.051,
      cap: 6_000_000,
      allocation: 0.42,
      tvl: 5_250_000
    },
    {
      name: "Morpho Gauntlet USDC Core",
      address: "0x0000000000000000000000000000000000000002",
      risk: "moderate",
      apy: 0.079,
      cap: 5_000_000,
      allocation: 0.33,
      tvl: 4_125_000
    },
    {
      name: "MetaMorpho Dynamic Stables",
      address: "0x0000000000000000000000000000000000000003",
      risk: "growth",
      apy: 0.105,
      cap: 3_500_000,
      allocation: 0.17,
      tvl: 2_125_000
    },
    {
      name: "Idle Buffer (Vault Cash)",
      address: "0x0000000000000000000000000000000000000004",
      risk: "conservative",
      apy: 0.0,
      cap: 1_000_000,
      allocation: 0.08,
      tvl: 1_000_000
    }
  ]
};
