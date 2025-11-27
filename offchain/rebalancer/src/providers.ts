import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/demo";

export const baseClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl)
});
