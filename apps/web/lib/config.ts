export const appConfig = {
  vaultAddress: (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  assetAddress: (process.env.NEXT_PUBLIC_ASSET_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453),
  rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined
};
