import type { Address } from "viem";
import type { MorphoVaultWithApy, VaultsResponse } from "./types.js";

const BASE_CHAIN_ID = 8453;

/**
 * Fetch APY data for specific MetaMorpho vault addresses from the Morpho
 * Blue GraphQL API. Fetches all vaults on Base and filters by the
 * requested strategy addresses. No asset filter is applied at the
 * GraphQL level since the API does not expose an `asset_in` field
 * on the VaultFilters type — filtering happens client-side.
 */
export async function fetchMetaMorphoVaultApys(
  apiUrl: string,
  strategyAddresses: Address[],
): Promise<MorphoVaultWithApy[]> {
  const addressSet = new Set(strategyAddresses.map((a) => a.toLowerCase()));
  if (addressSet.size === 0) return [];

  const query = `
    query GetBaseVaults {
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

  // Filter to only requested strategy addresses (case-insensitive)
  const matched = items.filter((v) =>
    addressSet.has(v.address.toLowerCase()),
  );

  return matched.map((v) => ({
    ...v,
    address: v.address.toLowerCase() as Address,
    apyDecimal: v.state.netApy != null ? v.state.netApy / 100 : 0,
  }));
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

  return items.map((v) => ({
    ...v,
    address: v.address.toLowerCase() as Address,
    apyDecimal: v.state.netApy != null ? v.state.netApy / 100 : 0,
  }));
}
