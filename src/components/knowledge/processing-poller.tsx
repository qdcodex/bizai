"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While a document is still PROCESSING, periodically refresh the page so the
 * status/page/chunk counts reflect real pipeline progress — no faked percentages. */
export function ProcessingPoller({ status }: { status: string }) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "PROCESSING") return;
    const interval = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(interval);
  }, [status, router]);

  return null;
}
