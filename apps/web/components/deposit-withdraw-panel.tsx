"use client";

import * as React from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import { blendedVaultAbi } from "@blended-vault/sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTxToast } from "@/components/tx-toast";
import { formatNumber, formatUsd } from "@/lib/format";
import {
  chain,
  chainId,
  usdcAddress,
  usdcDecimals,
  vaultAddress,
  safeVaultAddress,
  safeUsdcAddress,
} from "@/lib/chain";

type ActionMode = "deposit" | "withdraw";

export function DepositWithdrawPanel() {
  const { address, isConnected, chain: activeChain } = useAccount();
  const [amount, setAmount] = React.useState("");
  const [slippage, setSlippage] = React.useState("0.5");
  const [localNotice, setLocalNotice] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<ActionMode>("deposit");
  const { writeContractAsync, isPending, data: writeTxHash } = useWriteContract();
  const { trackTx } = useTxToast();
  const publicClient = usePublicClient({ chainId });

  const parsedAmount = safeParseUnits(amount, usdcDecimals);
  const slippageBps = parseSlippageBps(slippage);
  const hasConfig = Boolean(address && usdcAddress && vaultAddress);
  const isWrongNetwork = isConnected && activeChain ? activeChain.id !== chainId : false;

  const { data: balance } = useReadContract({
    abi: erc20Abi,
    address: safeUsdcAddress,
    functionName: "balanceOf",
    args: [address ?? "0x"],
    query: { enabled: Boolean(address && usdcAddress) },
  });

  const allowanceQuery = useReadContract({
    abi: erc20Abi,
    address: safeUsdcAddress,
    functionName: "allowance",
    args: [address ?? (safeVaultAddress as `0x${string}`), safeVaultAddress],
    query: { enabled: Boolean(address && usdcAddress && vaultAddress) },
  });
  const allowance = allowanceQuery.data;
  const refetchAllowance = allowanceQuery.refetch;

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
  const needsApproval = mode === "deposit"
    ? (allowanceKnown ? parsedAmount > allowance : true)
    : false;
  const isDepositPaused = Boolean(pausedDeposits);
  const isWithdrawPaused = Boolean(pausedWithdrawals);

  // ── Detect approve tx confirmation and auto-refetch allowance ───
  const { isLoading: isWaitingForApproval, isSuccess: approvalConfirmed } =
    useWaitForTransactionReceipt({
      hash: writeTxHash,
      query: { enabled: Boolean(writeTxHash) },
    });

  // Refetch allowance once the approve tx confirms
  React.useEffect(() => {
    if (approvalConfirmed) {
      refetchAllowance();
    }
  }, [approvalConfirmed, refetchAllowance]);

  // ── Write functions ────────────────────────────────────────────

  async function approve(): Promise<boolean> {
    if (!address || !usdcAddress || !vaultAddress || parsedAmount === 0n) return false;
    setLocalNotice(null);
    try {
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
      // Refetch allowance immediately after tx submission
      await refetchAllowance();
      return true;
    } catch {
      return false;
    }
  }

  async function deposit() {
    if (!address || !vaultAddress || parsedAmount === 0n) return;
    if (!(await checkSlippage("deposit"))) return;
    setLocalNotice(null);
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
    if (!address || !vaultAddress || parsedAmount === 0n) return;
    if (!(await checkSlippage("withdraw"))) return;
    setLocalNotice(null);
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

  // ── Single-button handler —────────────────────────────────────

  async function handleAction() {
    if (mode === "deposit") {
      if (needsApproval) {
        const ok = await approve();
        if (!ok) return;
        // Allowance will be refetched by the receipt watcher;
        // give it a moment then retry deposit
        await new Promise((r) => setTimeout(r, 1200));
        await refetchAllowance();
      }
      await deposit();
    } else {
      await withdraw();
    }
  }

  // ── Slippage check ────────────────────────────────────────────

  async function checkSlippage(action: ActionMode): Promise<boolean> {
    if (!vaultAddress || parsedAmount === 0n) return true;
    if (!publicClient) return true;
    if (slippageBps === null) {
      setLocalNotice("Invalid slippage tolerance. Use a positive number under 100%.");
      return false;
    }
    const baseline = action === "deposit" ? previewDeposit : previewWithdraw;
    if (baseline === undefined || baseline === 0n) return true;
    try {
      const latest = (await publicClient.readContract({
        abi: blendedVaultAbi,
        address: vaultAddress,
        functionName: action === "deposit" ? "previewDeposit" : "previewWithdraw",
        args: [parsedAmount],
      })) as bigint;
      if (action === "deposit") {
        const minShares = (baseline * (10_000n - slippageBps)) / 10_000n;
        if (latest < minShares) {
          setLocalNotice("Slippage check failed. Share output moved below tolerance.");
          return false;
        }
      } else {
        const maxShares = (baseline * (10_000n + slippageBps)) / 10_000n;
        if (latest > maxShares) {
          setLocalNotice("Slippage check failed. Shares required moved above tolerance.");
          return false;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch latest preview.";
      setLocalNotice(message);
      return false;
    }
    return true;
  }

  // ── Button label ──────────────────────────────────────────────

  const actionButtonLabel = (() => {
    if (!isConnected) return "Connect Wallet";
    if (mode === "deposit") {
      if (needsApproval && !isPending) return "Approve & Deposit";
      if (isPending) return "Pending...";
      return "Deposit";
    }
    if (isPending) return "Pending...";
    return "Withdraw";
  })();

  const actionEnabled = (() => {
    if (!isConnected || isWrongNetwork) return false;
    if (isPending) return false;
    if (parsedAmount === 0n) return false;
    if (!hasConfig) return false;
    if (mode === "deposit") {
      if (isDepositPaused && !isPending) return false;
    } else {
      if (isWithdrawPaused && !isPending) return false;
    }
    return true;
  })();

  // ── Render ────────────────────────────────────────────────────

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

        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg border border-border/70 bg-surfaceElevated/60 p-1 text-xs">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-center transition ${
              mode === "deposit"
                ? "bg-accent text-bg font-medium"
                : "text-muted hover:text-text"
            }`}
            onClick={() => { setMode("deposit"); setLocalNotice(null); }}
          >
            Deposit
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-center transition ${
              mode === "withdraw"
                ? "bg-accent text-bg font-medium"
                : "text-muted hover:text-text"
            }`}
            onClick={() => { setMode("withdraw"); setLocalNotice(null); }}
          >
            Withdraw
          </button>
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              placeholder="0.00"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setLocalNotice(null);
              }}
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
            {mode === "withdraw" ? (
              <span>
                Max withdraw:{" "}
                {maxWithdraw !== undefined ? formatUsd(maxWithdraw, usdcDecimals) : "--"}
              </span>
            ) : null}
          </div>
        </div>

        {/* Slippage */}
        <div className="space-y-2 text-xs text-muted">
          <div className="flex items-center justify-between gap-3">
            <span>Slippage tolerance</span>
            <div className="flex items-center gap-2">
              <Input
                className="w-20 text-right"
                value={slippage}
                onChange={(event) => setSlippage(event.target.value)}
                inputMode="decimal"
                placeholder="0.5"
              />
              <span>%</span>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Client-side check only. Onchain slippage guards are not available in v0.1.
          </p>
        </div>

        {localNotice ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {localNotice}
          </div>
        ) : null}

        {/* Single action button */}
        <Button
          className="w-full"
          onClick={handleAction}
          disabled={!actionEnabled || isWaitingForApproval}
        >
          {isWaitingForApproval ? "Waiting for approval..." : actionButtonLabel}
        </Button>

        {/* Info row */}
        <div className="space-y-2 text-xs text-muted">
          {mode === "deposit" ? (
            <>
              <div className="flex items-center justify-between">
                <span>Allowance</span>
                <span>
                  {allowance !== undefined ? formatNumber(allowance, usdcDecimals) : "--"} USDC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Est. shares</span>
                <span>
                  {previewDeposit !== undefined ? formatNumber(previewDeposit, usdcDecimals) : "--"}
                </span>
              </div>
              {needsApproval && allowanceKnown ? (
                <p>Approval required for {formatNumber(parsedAmount, usdcDecimals)} USDC.</p>
              ) : null}
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span>Est. shares burned</span>
              <span>
                {previewWithdraw !== undefined ? formatNumber(previewWithdraw, usdcDecimals) : "--"}
              </span>
            </div>
          )}
          <p>
            This is a synchronous vault. Withdrawals revert if liquidity is unavailable.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function safeParseUnits(value: string, decimals: number): bigint {
  if (!value) return 0n;
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

function formatInputUnits(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals);
  if (!formatted.includes(".")) return formatted;
  return formatted.replace(/\.?0+$/, "");
}

function parseSlippageBps(value: string): bigint | null {
  if (!value) return 0n;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric >= 100) return null;
  const bps = Math.round(numeric * 100);
  return BigInt(bps);
}
