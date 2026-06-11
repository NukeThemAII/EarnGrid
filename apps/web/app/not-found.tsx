import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-4 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-muted">EarnGrid</p>
      <h2 className="text-2xl font-semibold text-balance">Page not found</h2>
      <p className="text-sm text-muted">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
