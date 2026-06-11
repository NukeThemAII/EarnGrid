"use client";

import * as React from "react";
import { isAddress, keccak256, toBytes } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

import { blendedVaultAbi } from "@blended-vault/sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTxToast } from "@/components/tx-toast";
import { chain, chainId, vaultAddress, safeVaultAddress } from "@/lib/chain";
import { accessControlAbi } from "@/lib/contracts";
import { ALLOCATOR_ROLE, CURATOR_ROLE, DEFAULT_ADMIN_ROLE, GUARDIAN_ROLE } from "@/lib/roles";

export function AdminActions() {
  const { address, isConnected, chain: activeChain } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { trackTx } = useTxToast();
  const [depositQueueInput, setDepositQueueInput] = React.useState("");
  const [withdrawQueueInput, setWithdrawQueueInput] = React.useState("");
  const [capInput, setCapInput] = React.useState("");
  const [salt, setSalt] = React.useState(() => createSalt());
  const [notice, setNotice] = React.useState<string | null>(null);

  const { data: isAdmin } = useReadContract({
    abi: accessControlAbi,
    address: safeVaultAddress,
    functionName: "hasRole",
    args: [DEFAULT_ADMIN_ROLE, address ?? "0x"],
    query: { enabled: Boolean(address && vaultAddress) },
  });

  const { data: isCurator } = useReadContract({
    abi: accessControlAbi,
    address: safeVaultAddress,
    functionName: "hasRole",
    args: [CURATOR_ROLE, address ?? "0x"],
    query: { enabled: Boolean(address && vaultAddress) },
  });

  const { data: isAllocator } = useReadContract({
    abi: accessControlAbi,
    address: safeVaultAddress,
    functionName: "hasRole",
    args: [ALLOCATOR_ROLE, address ?? "0x"],
    query: { enabled: Boolean(address && vaultAddress) },
  });

  const { data: isGuardian } = useReadContract({
    abi: accessControlAbi,
    address: safeVaultAddress,
    functionName: "hasRole",
    args: [GUARDIAN_ROLE, address ?? "0x"],
    query: { enabled: Boolean(address && vaultAddress) },
  });

  const roleLabel = isAdmin
    ? "Owner"
    : isCurator
      ? "Curator"
      : isAllocator
        ? "Allocator"
        : isGuardian
          ? "Guardian"
          : "Viewer";

  const isWrongNetwork = isConnected && activeChain ? activeChain.id !== chainId : false;
  const canWrite = Boolean(vaultAddress && isConnected && !isWrongNetwork);

  async function harvest() {
    if (!vaultAddress) {
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "harvest",
          args: [],
        }),
      { title: "Harvest" }
    );
  }

  async function pauseDeposits() {
    if (!vaultAddress) {
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "pauseDeposits",
          args: [],
        }),
      { title: "Pause deposits" }
    );
  }

  async function pauseWithdrawals() {
    if (!vaultAddress) {
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "pauseWithdrawals",
          args: [],
        }),
      { title: "Pause withdrawals" }
    );
  }

  async function updateDepositQueue() {
    if (!vaultAddress) {
      return;
    }
    const { entries, error } = parseQueueInput(depositQueueInput);
    if (error) {
      setNotice(error);
      return;
    }
    if (entries.length === 0) {
      setNotice("Deposit queue is empty.");
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "setDepositQueue",
          args: [entries],
        }),
      { title: "Update deposit queue" }
    );
  }

  async function updateWithdrawQueue() {
    if (!vaultAddress) {
      return;
    }
    const { entries, error } = parseQueueInput(withdrawQueueInput);
    if (error) {
      setNotice(error);
      return;
    }
    if (entries.length === 0) {
      setNotice("Withdraw queue is empty.");
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "setWithdrawQueue",
          args: [entries],
        }),
      { title: "Update withdraw queue" }
    );
  }

  async function scheduleCapIncrease() {
    if (!vaultAddress) {
      return;
    }
    setNotice(null);
    const [strategy, cap] = capInput.split(",").map((value) => value.trim());
    if (!strategy || !cap) {
      setNotice('Format: "strategy,cap" where cap is in USDC decimals.');
      return;
    }
    if (!isAddress(strategy)) {
      setNotice("Invalid strategy address.");
      return;
    }
    let capValue: bigint;
    try {
      capValue = BigInt(cap);
    } catch {
      setNotice("Cap must be a valid integer in USDC decimals.");
      return;
    }
    await trackTx(
      () =>
        writeContractAsync({
          abi: blendedVaultAbi,
          address: vaultAddress,
          functionName: "scheduleCapIncrease",
          args: [strategy as `0x${string}`, capValue, keccak256(toBytes(salt))],
        }),
      { title: "Schedule cap increase" }
    );
    setSalt(createSalt());
  }

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-sm text-muted">Admin actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>Role detected:</span>
          <span className="rounded-full border border-border px-2 py-1 text-text">{roleLabel}</span>
          {isWrongNetwork ? (
            <Badge variant="default">Wrong network (switch to {chain.name})</Badge>
          ) : null}
        </div>
        {!isConnected ? (
          <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 px-3 py-2 text-xs text-muted">
            Connect a wallet with the required role to enable admin actions.
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {notice}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            disabled={!isAllocator || isPending || !canWrite}
            onClick={harvest}
          >
            Harvest
          </Button>
          <Button
            variant="outline"
            disabled={!isGuardian || isPending || !canWrite}
            onClick={pauseDeposits}
          >
            Pause Deposits
          </Button>
          <Button
            variant="outline"
            disabled={!isGuardian || isPending || !canWrite}
            onClick={pauseWithdrawals}
          >
            Pause Withdrawals
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">Deposit queue (comma or newline separated).</p>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            value={depositQueueInput}
            onChange={(event) => setDepositQueueInput(event.target.value)}
            placeholder={"0xStrategyA\n0xStrategyB"}
            rows={3}
          />
          <Button
            variant="outline"
            disabled={!isAllocator || isPending || !canWrite}
            onClick={updateDepositQueue}
          >
            Update Deposit Queue
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">Withdraw queue (comma or newline separated).</p>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            value={withdrawQueueInput}
            onChange={(event) => setWithdrawQueueInput(event.target.value)}
            placeholder={"0xStrategyA\n0xStrategyB"}
            rows={3}
          />
          <Button
            variant="outline"
            disabled={!isAllocator || isPending || !canWrite}
            onClick={updateWithdrawQueue}
          >
            Update Withdraw Queue
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">Schedule cap increase: "strategy,cap" and salt.</p>
          <Input
            value={capInput}
            onChange={(event) => setCapInput(event.target.value)}
            placeholder="0xStrategy,1000000000"
          />
          <Input value={salt} onChange={(event) => setSalt(event.target.value)} placeholder="salt" />
          <Button
            variant="outline"
            disabled={!isCurator || isPending || !canWrite}
            onClick={scheduleCapIncrease}
          >
            Schedule Cap Increase
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function parseQueueInput(value: string): { entries: `0x${string}`[]; error?: string } {
  const entries = value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!entries.length) {
    return { entries: [] };
  }

  const invalid = entries.find((entry) => !isAddress(entry));
  if (invalid) {
    return { entries: [], error: `Invalid address: ${invalid}` };
  }

  return { entries: entries as `0x${string}`[] };
}

function createSalt(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `salt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
