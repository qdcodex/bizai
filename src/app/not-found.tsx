import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4 text-center">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <span className="text-lg font-semibold">BizAI</span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <p className="text-sm text-muted-foreground">This page doesn&apos;t exist.</p>
      </div>
      <Button render={<Link href="/dashboard" />}>Go to Dashboard</Button>
    </div>
  );
}
