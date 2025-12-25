"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-4 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-muted">MetaYield</p>
      <h2 className="text-2xl font-semibold text-balance">Something went wrong.</h2>
      <p className="text-sm text-muted">
        The app hit an unexpected error. Try again or refresh the page.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
