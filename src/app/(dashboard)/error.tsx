"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardSegmentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-10 w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <p className="text-base font-medium">Something went wrong loading this page</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          This is usually temporary. Try again, or head back to the dashboard.
        </p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
        <div className="mt-2 flex gap-2">
          <Button variant="outline" render={<Link href="/dashboard" />}>
            Go to Dashboard
          </Button>
          <Button onClick={() => retry()}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
