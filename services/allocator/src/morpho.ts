import type { Address } from "viem";
import type { MorphoVault, MorphoVaultWithApy, VaultsResponse } from "./types.js";

const BASE_CHAIN_ID = 8453;

export async function fetchMetaMorphoVaultApys(
  apiUrl: string,
  strategyAddresses: Address[],
): Promise<MorphoVaultWithApy[]> {
  const addresses = [...new Set(strategyAddresses.map((address) => address.toLowerCase()))];
  if (addresses.length === 0) return [];
  const addressList = addresses.map((address) => `"${address}"`).join(", ");

  const query = `
    query GetBaseVaultsByAddress {
      vaults(
        where: {
          chainId_in: [${BASE_CHAIN_ID}]
          address_in: [${addressList}]
        }
        first: ${addresses.length}
      ) {
        items {
          address
          name
          symbol
          state {
            netApy
            totalAssetsUsd
          }
        }
      }
    }
  `;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Morpho GraphQL API returned ${response.status}: ${text.slice(0, 200)}`,
    );
  }

  const json: VaultsResponse = await response.json();

  if (json.errors?.length) {
    throw new Error(
      `Morpho GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const items = json.data?.vaults?.items ?? [];
  return items.map((vault) => toMorphoVaultWithApy(vault));
}

/**
 * Fetch all MetaMorpho vaults on Base for debugging / discovery.
 */
export async function fetchAllBaseVaults(
  apiUrl: string,
): Promise<MorphoVaultWithApy[]> {
  const query = `
    query GetAllBaseVaults {
      vaults(
        where: {
          chainId_in: [${BASE_CHAIN_ID}]
        }
        first: 100
      ) {
        items {
          address
          name
          symbol
          state {
            netApy
            totalAssetsUsd
          }
        }
      }
    }
  `;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Morpho API returned ${response.status}`);
  }

  const json: VaultsResponse = await response.json();
  const items = json.data?.vaults?.items ?? [];

  return items.map((vault) => toMorphoVaultWithApy(vault));
}

export function toMorphoVaultWithApy(vault: MorphoVault): MorphoVaultWithApy {
  return {
    address: vault.address.toLowerCase() as Address,
    name: vault.name,
    symbol: vault.symbol,
    state: {
      netApy: vault.state.netApy,
      totalAssetsUsd: vault.state.totalAssetsUsd,
    },
    apyDecimal: vault.state.netApy ?? 0,
  };
}
