export const earngridVaultAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "address", name: "receiver", type: "address" }
    ],
    name: "deposit",
    outputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "address", name: "receiver", type: "address" },
      { internalType: "address", name: "owner", type: "address" }
    ],
    name: "withdraw",
    outputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "asset",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalAssets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "assets", type: "uint256" }],
    name: "convertToShares",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "maxWithdraw",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "strategy", type: "address" }],
    name: "getStrategy",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "cap", type: "uint256" },
          { internalType: "uint256", name: "allocPoint", type: "uint256" },
          { internalType: "uint256", name: "totalManagedAssets", type: "uint256" },
          { internalType: "bool", name: "enabled", type: "bool" }
        ],
        internalType: "struct IEarnGridVault.StrategyData",
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "supplyQueueLength",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
    name: "supplyQueue",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "withdrawQueueLength",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
    name: "withdrawQueue",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "timelock",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "fee",
    outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "curator",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "guardian",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "isAllocator",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "strategy", type: "address" }, { internalType: "uint256", name: "cap", type: "uint256" }],
    name: "submitCap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address[]", name: "newQueue", type: "address[]" }],
    name: "setSupplyQueue",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "strategy", type: "address" }],
    name: "pendingCap",
    outputs: [
      { internalType: "uint136", name: "value", type: "uint136" },
      { internalType: "uint64", name: "validAt", type: "uint64" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "strategy", type: "address" }],
    name: "acceptCap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "id", type: "address" },
          { internalType: "uint256", name: "assets", type: "uint256" }
        ],
        internalType: "struct MarketAllocation[]",
        name: "allocations",
        type: "tuple[]"
      }
    ],
    name: "reallocate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;
