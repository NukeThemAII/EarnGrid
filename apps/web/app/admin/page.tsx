"use client";

import { useAccount, useReadContract, useWriteContract, useReadContracts } from "wagmi";
import { earngridVaultAbi } from "../../lib/abi/earngridVault";
import { appConfig } from "../../lib/config";
import { primaryVault } from "../../lib/vaults";
import { useState } from "react";
import { parseUnits, isAddress, formatUnits } from "viem";
import { Shield, Users, Lock, AlertTriangle } from "lucide-react";

export default function AdminPage() {
    const strategies = primaryVault.strategies;
    const { address } = useAccount();
    const chainId = appConfig.chainId;
    const vaultAddress = appConfig.vaultAddress;

    const { data: owner } = useReadContract({
        address: vaultAddress,
        abi: earngridVaultAbi,
        functionName: "owner",
        chainId
    });

    const { data: curator } = useReadContract({
        address: vaultAddress,
        abi: earngridVaultAbi,
        functionName: "curator",
        chainId
    });

    const { data: guardian } = useReadContract({
        address: vaultAddress,
        abi: earngridVaultAbi,
        functionName: "guardian",
        chainId
    });

    const { data: isAllocator } = useReadContract({
        address: vaultAddress,
        abi: earngridVaultAbi,
        functionName: "isAllocator",
        args: [address || "0x0000000000000000000000000000000000000000"],
        chainId,
        query: { enabled: !!address }
    });

    const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();
    const isCurator = address && curator && address.toLowerCase() === curator.toLowerCase();
    const isGuardian = address && guardian && address.toLowerCase() === guardian.toLowerCase();
    const hasAllocatorRole = !!isAllocator;

    const { writeContractAsync } = useWriteContract();
    const [capStrategy, setCapStrategy] = useState("");
    const [capAmount, setCapAmount] = useState("");
    const [status, setStatus] = useState<string | null>(null);

    async function handleSubmitCap(e: React.FormEvent) {
        e.preventDefault();
        if (!isAddress(capStrategy)) {
            setStatus("Invalid strategy address");
            return;
        }
        if (!capAmount || Number(capAmount) <= 0) {
            setStatus("Enter a positive cap amount");
            return;
        }
        try {
            setStatus("Submitting...");
            await writeContractAsync({
                address: vaultAddress,
                abi: earngridVaultAbi,
                functionName: "submitCap",
                args: [capStrategy, parseUnits(capAmount, 6)], // Assuming USDC 6 decimals
                chainId
            });
            setStatus("Transaction sent!");
        } catch (err: any) {
            setStatus(err.message || "Failed");
        }
    }

    // Fetch pending caps for all known strategies
    const pendingCapCalls = strategies.map((s) => ({
        address: vaultAddress,
        abi: earngridVaultAbi,
        functionName: "pendingCap",
        args: [s.address],
        chainId
    }));

    const { data: pendingCapsData } = useReadContracts({
        contracts: pendingCapCalls,
        query: { enabled: !!vaultAddress }
    });

    // Filter for active pending caps
    const pendingCaps = strategies.map((s, i) => {
        const result = pendingCapsData?.[i]?.result as [bigint, bigint] | undefined;
        if (!result) return null;
        const [value, validAt] = result;
        if (validAt === 0n) return null;
        return { ...s, pendingValue: value, validAt };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    async function handleAcceptCap(strategyAddress: `0x${string}`) {
        try {
            setStatus("Accepting cap...");
            await writeContractAsync({
                address: vaultAddress,
                abi: earngridVaultAbi,
                functionName: "acceptCap",
                args: [strategyAddress],
                chainId
            });
            setStatus("Cap accepted!");
        } catch (err: any) {
            setStatus(err.message || "Failed");
        }
    }

    if (!address) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <p className="text-slate-500">Connect wallet to view admin controls</p>
            </div>
        );
    }

    if (!isOwner && !isCurator && !isGuardian && !hasAllocatorRole) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <h2 className="text-xl font-semibold text-ink">Access Denied</h2>
                <p className="text-slate-500">You do not have any admin roles on this vault.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                <h1 className="text-2xl font-bold text-ink">Admin Dashboard</h1>
                <p className="text-slate-500">Manage vault parameters and safety controls.</p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {isOwner && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">OWNER</span>}
                    {isCurator && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">CURATOR</span>}
                    {hasAllocatorRole && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">ALLOCATOR</span>}
                    {isGuardian && <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">GUARDIAN</span>}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Curator Panel */}
                {(isCurator || isOwner) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                        <div className="mb-4 flex items-center gap-2">
                            <Shield className="text-emerald-600" />
                            <h2 className="text-lg font-semibold text-ink">Curator Controls</h2>
                        </div>
                        <form onSubmit={handleSubmitCap} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Strategy Address</label>
                                <input
                                    type="text"
                                    value={capStrategy}
                                    onChange={(e) => setCapStrategy(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                    placeholder="0x..."
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">New Cap (USDC)</label>
                                <input
                                    type="number"
                                    value={capAmount}
                                    onChange={(e) => setCapAmount(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                    placeholder="1000000"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                            >
                                Submit Cap
                            </button>
                            {status && <p className="text-xs text-slate-500">{status}</p>}
                        </form>
                    </div>
                )}

                {/* Allocator Panel */}
                {(hasAllocatorRole || isOwner) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                        <div className="mb-4 flex items-center gap-2">
                            <Users className="text-blue-600" />
                            <h2 className="text-lg font-semibold text-ink">Allocator Controls</h2>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Queue management is currently read-only. Use CLI for complex reallocations.
                        </p>
                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-medium text-slate-400 uppercase">Supply Queue</p>
                            <p className="text-sm text-slate-600 italic">Coming soon: Drag & Drop Reordering</p>
                        </div>
                    </div>
                )}

                {/* Guardian Panel */}
                {(isGuardian || isOwner) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                        <div className="mb-4 flex items-center gap-2">
                            <Lock className="text-rose-600" />
                            <h2 className="text-lg font-semibold text-ink">Guardian Controls</h2>
                        </div>
                        {pendingCaps.length === 0 ? (
                            <p className="text-sm text-slate-500">No pending caps detected.</p>
                        ) : (
                            <div className="space-y-3">
                                {pendingCaps.map((pc) => (
                                    <div key={pc.address} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                                        <div>
                                            <p className="text-sm font-medium text-ink">{pc.name}</p>
                                            <p className="text-xs text-slate-500">
                                                New Cap: {formatUnits(pc.pendingValue, 6)} USDC
                                                <br />
                                                Valid At: {new Date(Number(pc.validAt) * 1000).toLocaleString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleAcceptCap(pc.address as `0x${string}`)}
                                            className="rounded-lg bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                                        >
                                            Accept
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
