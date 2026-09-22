"use client";

import Link from "next/link";
import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoiceActions({ quotationId }: { quotationId: string }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" render={<Link href={`/quotations/${quotationId}`} />}>
        <FileText />
        View Quotation
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer />
        Print
      </Button>
    </div>
  );
}
