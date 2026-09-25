import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardNotFound() {
  return (
    <Card className="mx-auto mt-10 w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-5 text-muted-foreground" />
        </div>
        <p className="text-base font-medium">We couldn&apos;t find that</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          The record may have been deleted, or the link is incorrect.
        </p>
        <Button className="mt-2" render={<Link href="/dashboard" />}>
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
