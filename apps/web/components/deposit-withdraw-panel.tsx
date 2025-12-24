"use client";

import * as React from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

import { blendedVaultAbi } from "@blended-vault/sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTxToast } from "@/components/tx-toast";
import { formatNumber, formatUsd } from "@/lib/format";
import { chain, chainId, usdcAddress, usdcDecimals, vaultAddress } from "@/lib/chain";

export function DepositWithdrawPanel() {
  const { address, isConnected, chain: activeChain } = useAccount();
  const [amount, setAmount] = React.useState("");
  const { writeContractAsync, isPending } = useWriteContract();
  const { trackTx } = useTxToast();

  const parsedAmount = safeParseUnits(amount, usdcDecimals);
  const safeVaultAddress = (vaultAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const safeUsdcAddress = (usdcAddress || "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const hasConfig = Boolean(address && usdcAddress && vaultAddress);
  const isWrongNetwork = isConnected && activeChain ? activeChain.id !== chainId : false;

  const { data: balance } = useReadContract({
    abi: erc20Abi,
    address: safeUsdcAddress,
    functionName: "balanceOf",
    args: [address ?? "0x"],
    query: { enabled: Boolean(address && usdcAddress) },
  });

  const { data: allowance } = useReadContract({
    abi: erc20Abi,
    address: safeUsdcAddress,
    functionName: "allowance",
    args: [address ?? safeVaultAddress, safeVaultAddress],
    query: { enabled: Boolean(address && usdcAddress && vaultAddress) },
  });

  const { data: pausedDeposits } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "pausedDeposits",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: pausedWithdrawals } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "pausedWithdrawals",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: previewDeposit } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "previewDeposit",
    args: [parsedAmount],
    query: { enabled: Boolean(vaultAddress && parsedAmount > 0n) },
  });

  const { data: previewWithdraw } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "previewWithdraw",
    args: [parsedAmount],
    query: { enabled: Boolean(vaultAddress && parsedAmount > 0n) },
  });

  const { data: maxWithdraw } = useReadContract({
    abi: blendedVaultAbi,
    address: safeVaultAddress,
    functionName: "maxWithdraw",
    args: [address ?? "0x"],
    query: { enabled: Boolean(address && vaultAddress) },
  });

  const allowanceKnown = allowance !== undefined;
  const needsApproval = allowanceKnown ? parsedAmount > allowance : true;
  const isDepositPaused = Boolean(pausedDeposits);
  const isWithdrawPaused = Boolean(pausedWithdrawals);

  async function approve() {
    if (!address || !usdcAddress || !vaultAddress || parsedAmount === 0n) {
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: erc20Abi,
          address: usdcAddress,
          functionName: "approve",
          args: [vaultAddress, parsedAmount],
        }),
      { title: "Approve USDC" }
    );
  }

  async function deposit() {
    if (!address || !vaultAddress || parsedAmount === 0n) {
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "deposit",
          args: [parsedAmount, address],
        }),
      { title: "Deposit USDC" }
    );
  }

  async function withdraw() {
    if (!address || !vaultAddress || parsedAmount === 0n) {
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "withdraw",
          args: [parsedAmount, address, address],
        }),
      { title: "Withdraw USDC" }
    );
  }

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-sm text-muted">Deposit / Withdraw</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isWrongNetwork ? (
          <div className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <span>Wrong network connected.</span>
            <Badge variant="default">Switch to {chain.name}</Badge>
          </div>
        ) : null}
        {!isConnected ? (
          <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 px-3 py-2 text-xs text-muted">
            Connect a wallet to deposit or withdraw.
          </div>
        ) : null}
        {!vaultAddress ? (
          <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 px-3 py-2 text-xs text-muted">
            Set `NEXT_PUBLIC_VAULT_ADDRESS` to enable vault actions.
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="relative">
            <Input
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setAmount(formatInputUnits(balance ?? 0n, usdcDecimals))}
                disabled={!isConnected || !balance || balance === 0n}
              >
                Max
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span>
              Wallet balance:{" "}
              {balance !== undefined ? formatUsd(balance, usdcDecimals) : "--"}
            </span>
            <span>
              Max withdraw:{" "}
              {maxWithdraw !== undefined ? formatUsd(maxWithdraw, usdcDecimals) : "--"}
            </span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={approve}
            disabled={
              !isConnected ||
              isWrongNetwork ||
              isPending ||
              parsedAmount === 0n ||
              !hasConfig ||
              (!needsApproval && allowanceKnown)
            }
          >
            {needsApproval ? "Approve USDC" : "Approved"}
          </Button>
          <Button
            onClick={deposit}
            disabled={
              !isConnected ||
              isWrongNetwork ||
              isPending ||
              needsApproval ||
              isDepositPaused ||
              !hasConfig
            }
          >
            Deposit
          </Button>
          <Button
            variant="outline"
            onClick={withdraw}
            disabled={!isConnected || isWrongNetwork || isPending || isWithdrawPaused || !hasConfig}
          >
            Withdraw
          </Button>
        </div>
        <div className="space-y-2 text-xs text-muted">
          <div className="flex items-center justify-between">
            <span>Allowance</span>
            <span>
              {allowance !== undefined ? formatNumber(allowance, usdcDecimals) : "--"} USDC
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Est. shares (deposit)</span>
            <span>
              {previewDeposit !== undefined ? formatNumber(previewDeposit, usdcDecimals) : "--"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Est. shares burned (withdraw)</span>
            <span>
              {previewWithdraw !== undefined ? formatNumber(previewWithdraw, usdcDecimals) : "--"}
            </span>
          </div>
          <p>
            This is a synchronous vault. Withdrawals revert if liquidity is unavailable.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function safeParseUnits(value: string, decimals: number): bigint {
  if (!value) {
    return 0n;
  }
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

function formatInputUnits(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals);
  if (!formatted.includes(".")) {
    return formatted;
  }
  return formatted.replace(/\.?0+$/, "");
}
