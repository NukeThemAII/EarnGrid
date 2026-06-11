import type { Metadata } from "next";

import { AdminActions } from "@/components/admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Admin · EarnGrid",
  description: "Role-gated admin panel for EarnGrid vault management.",
};

export default function AdminPage() {
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
