import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toMorphoVaultWithApy } from "../src/morpho.js";

describe("Morpho APY mapping", () => {
  it("keeps netApy as a decimal fraction", () => {
    const vault = toMorphoVaultWithApy({
      address: "0x0000000000000000000000000000000000000001",
      name: "Test USDC",
      symbol: "tUSDC",
      state: {
        netApy: 0.0425,
        totalAssetsUsd: "1000",
      },
    });

    assert.equal(vault.apyDecimal, 0.0425);
  });
});
