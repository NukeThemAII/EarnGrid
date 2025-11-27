"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useAccount, useSimulateContract, useWriteContract } from "wagmi";
import { parseUnits, zeroAddress } from "viem";
import { earngridVaultAbi } from "../lib/abi/earngridVault";
import { erc20Abi } from "../lib/abi/erc20";

const amountSchema = z
  .string()
  .trim()
  .regex(/^[0-9]*[.]?[0-9]*$/, "Enter a numeric amount")
  .refine((val) => Number(val) > 0, "Amount must be greater than zero");

type Mode = "deposit" | "withdraw";

interface ActionPanelProps {
  vaultAddress: `0x${string}`;
  assetAddress: `0x${string}`;
  chainId: number;
  decimals: number;
  sharePrice: number;
}

export function ActionPanel({ vaultAddress, assetAddress, chainId, decimals, sharePrice }: ActionPanelProps) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("1000");
  const [error, setError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const receiver = (address || zeroAddress) as `0x${string}`;

  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || "0", decimals);
    } catch {
      return 0n;
    }
  }, [amount, decimals]);

  const actionArgs =
    mode === "deposit" ? [parsedAmount, receiver] : [parsedAmount, receiver, receiver];

  const { data: simulation, error: simulationError, isLoading: simLoading } = useSimulateContract({
    address: vaultAddress,
    abi: earngridVaultAbi,
    functionName: mode === "deposit" ? "deposit" : "withdraw",
    args: actionArgs as readonly unknown[],
    chainId,
    query: {
      enabled:
        isConnected &&
        vaultAddress !== "0x0000000000000000000000000000000000000000" &&
        parsedAmount > 0n &&
        address !== undefined
    }
  });

  const sharesEstimate = useMemo(() => {
    const numeric = Number(amount);
    return Number.isFinite(numeric) ? numeric / sharePrice : 0;
  }, [amount, sharePrice]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = amountSchema.safeParse(amount);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid amount");
      return;
    }
    if (!isConnected || !address) {
      setError("Connect your wallet first");
      return;
    }
    if (parsedAmount === 0n) {
      setError("Enter an amount greater than zero");
      return;
    }

    setError(null);
    setTxError(null);
    setIsSubmitting(true);
    setError(null);
    try {
      const request =
        simulation?.request ??
        ({
          address: vaultAddress,
          abi: earngridVaultAbi,
          functionName: mode === "deposit" ? "deposit" : "withdraw",
          args: actionArgs,
          chainId
        } as const);

      await writeContractAsync(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setTxError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onApprove() {
    if (!isConnected || !address) {
      setError("Connect your wallet first");
      return;
    }
    if (parsedAmount === 0n) {
      setError("Enter an amount greater than zero");
      return;
    }

    setError(null);
    setTxError(null);
    setIsSubmitting(true);
    try {
      await writeContractAsync({
        address: assetAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress, parsedAmount],
        chainId
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Approval failed";
      setTxError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-soft backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Actions</p>
          <p className="text-lg font-semibold text-ink">Deposit or withdraw</p>
        </div>
        <div className="flex gap-2 rounded-full bg-slate-100 p-1">
          {(["deposit", "withdraw"] as Mode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                mode === item ? "bg-ink text-white shadow-soft" : "text-slate-600"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Amount (USDC)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none ring-0 transition focus:border-teal focus:shadow-soft"
            placeholder="1000"
            inputMode="decimal"
            autoComplete="off"
          />
        </label>

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Estimated shares</span>
            <span className="font-semibold text-ink">{sharesEstimate.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Share price</span>
            <span className="font-semibold text-ink">${sharePrice.toFixed(4)}</span>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {txError ? <p className="text-sm text-rose-600">{txError}</p> : null}
        {simulationError ? <p className="text-sm text-amber-700">Simulation: {simulationError.message}</p> : null}

        {!isConnected ? (
          <div className="flex justify-end">
            <ConnectButton label="Connect wallet" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-ink transition hover:-translate-y-[1px] hover:shadow-soft"
              disabled={isSubmitting}
            >
              Approve USDC for vault
            </button>
            <button
              type="submit"
              className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:shadow-soft disabled:opacity-70"
              disabled={isSubmitting || simLoading}
            >
              {isSubmitting ? "Submitting..." : mode === "deposit" ? "Deposit USDC" : "Withdraw USDC"}
            </button>
          </div>
        )}
      </form>

      <p className="mt-3 text-xs text-slate-500">
        Deposits and withdrawals use the EulerEarn-powered EarnGrid vault. You may need to approve USDC to the vault before
        depositing. Allocations may smear over time to reduce slippage.
      </p>
    </div>
  );
}
