import type { Address } from "viem";

// ---------------------------------------------------------------------------
// Types matching the MetaMorpho / Morpho Blue GraphQL schema
// ---------------------------------------------------------------------------

/** A Morpho Blue MetaMorpho vault as returned by the GraphQL API */
export interface MorphoVault {
  address: Address;
  name: string;
  symbol: string;
  state: {
    netApy: number | null;
    totalAssetsUsd: string | null;
  };
}

/** MetaMorpho vault with a computed effective APY */
export interface MorphoVaultWithApy extends MorphoVault {
  /** netApy as a decimal fraction (e.g. 0.05 = 5 %). Falls back to 0 if null. */
  apyDecimal: number;
}

/** Response shape from the blue-api GraphQL */
export interface VaultsResponse {
  data?: {
    vaults?: {
      items: MorphoVault[];
    };
  };
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Known USDC MetaMorpho vaults on Base (from STRATEGY_UNIVERSE.md)
// ---------------------------------------------------------------------------
export const KNOWN_USDC_METAMORPHO_VAULTS: Address[] = [
  "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183", // steakUSDC
  "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A", // sparkUSDC
  "0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61", // gtUSDCp
  "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738", // smUSDC
  "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca", // mwUSDC
];

export const METAMORPHO_VAULT_NAMES: Record<string, string> = {
  "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183": "steakUSDC",
  "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A": "sparkUSDC",
  "0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61": "gtUSDCp",
  "0x616a4E1db48e22028f6bbf20444Cd3b8e3273738": "smUSDC",
  "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca": "mwUSDC",
};
