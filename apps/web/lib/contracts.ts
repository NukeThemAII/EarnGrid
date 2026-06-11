/**
 * Shared contract utilities and ABIs used across multiple onchain components.
 * Extracted to avoid duplication between onchain-strategies.tsx,
 * onchain-allocation-summary.tsx, and admin-actions.tsx.
 */

export const erc20MetadataAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const accessControlAbi = [
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/** Chart colors shared across allocation components. */
export const ALLOCATION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--accent-strong)",
];

/**
 * Safely unwrap a wagmi useReadContracts result entry.
 * Returns the result value or null if the call failed or is pending.
 */
export function unwrapResult<T>(value: unknown): T | null {
  if (value && typeof value === "object") {
    if ("result" in value) {
      const result = (value as { result?: T | null }).result;
      return result ?? null;
    }
    return null;
  }
  if (value !== undefined && value !== null) {
    return value as T;
  }
  return null;
}

/**
 * Return a typed address, falling back to the zero address when the input
 * is empty. Used to satisfy wagmi hooks that require a non-empty address
 * even when the vault address env var is not yet configured.
 */
export function safeAddress(address: string | undefined): `0x${string}` {
  return (address && address.length > 0
    ? address
    : "0x0000000000000000000000000000000000000000") as `0x${string}`;
}
