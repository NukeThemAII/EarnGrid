"use client";

import { useAccount } from "wagmi";

import { AdminActions } from "@/components/admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  const { address, isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle className="text-sm text-muted">Admin panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Connect your wallet with an admin, curator, allocator, or guardian role to access vault
              management actions.
            </p>
            <div className="rounded-lg border border-border/70 bg-surfaceElevated/60 p-4 text-sm text-muted">
              <p className="mb-2 font-medium text-text">Role actions available:</p>
              <ul className="list-disc space-y-1 pl-5 text-xs">
                <li>Allocator: harvest fees and update deposit/withdraw queues.</li>
                <li>Guardian: pause deposits or withdrawals, emergency remove strategies.</li>
                <li>Curator: manage strategy allowlist, caps, and tier limits.</li>
                <li>Owner: role management and fee recipient changes.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle className="text-sm text-muted">Admin overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            <p>
              Role-gated actions are available to the curator, allocator, guardian, and owner. Risk
              increasing changes must be scheduled and executed after the timelock delay.
            </p>
            <ul className="space-y-2 text-xs text-muted">
              <li>Allocator: harvest + queues.</li>
              <li>Guardian: pause deposits/withdrawals and emergency removals.</li>
              <li>Curator: strategy allowlist, caps, tier limits (timelocked if increasing risk).</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle className="text-sm text-muted">Timelock guidance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted">
            For risk-increasing actions, use schedule + execute after the delay. Risk-reducing changes
            can be applied immediately by the curator or guardian per policy.
          </CardContent>
        </Card>
      </div>
      <AdminActions />
    </div>
  );
}
