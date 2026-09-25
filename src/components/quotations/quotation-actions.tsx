"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { QuotationStatus } from "@/models/Quotation";

export function QuotationActions({
  quotationId,
  status,
  canUpdate,
  canApprove,
  canDelete,
}: {
  quotationId: string;
  status: QuotationStatus;
  canUpdate: boolean;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function post(path: string, successMessage: string, body?: unknown) {
    setPendingAction(path);
    try {
      const response = await fetch(`/api/quotations/${quotationId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(successMessage);
      if (path === "/convert") {
        router.push(`/invoices/${quotationId}`);
      }
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    const response = await fetch(`/api/quotations/${quotationId}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Quotation deleted");
    router.push("/quotations");
    router.refresh();
  }

  const isBusy = (action: string) => pendingAction === action;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && canUpdate && (
        <>
          <Button variant="outline" render={<Link href={`/quotations/${quotationId}/edit`} />}>
            <Pencil />
            Edit
          </Button>
          <Button disabled={pendingAction !== null} onClick={() => post("/submit", "Submitted for approval")}>
            {isBusy("/submit") ? <Loader2 className="animate-spin" /> : null}
            Submit
          </Button>
        </>
      )}
      {status === "DRAFT" && canDelete && (
        <ConfirmDialog
          trigger={<Button variant="outline">Delete</Button>}
          title="Delete this draft?"
          description="This quotation will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
        />
      )}

      {status === "PENDING_APPROVAL" && canApprove && (
        <>
          <Button disabled={pendingAction !== null} onClick={() => post("/approve", "Quotation approved")}>
            {isBusy("/approve") ? <Loader2 className="animate-spin" /> : null}
            Approve
          </Button>
          <ConfirmDialog
            trigger={<Button variant="outline">Reject</Button>}
            title="Reject this quotation?"
            description="The requester will need to revise and resubmit it."
            confirmLabel="Reject"
            destructive
            onConfirm={() => post("/reject", "Quotation rejected")}
          />
        </>
      )}

      {status === "APPROVED" && canUpdate && (
        <ConfirmDialog
          trigger={<Button disabled={pendingAction !== null}>Convert to Sale</Button>}
          title="Convert to a sale?"
          description="Stock for every line item will be deducted from inventory and an invoice will be created. This cannot be undone."
          confirmLabel="Convert"
          onConfirm={() => post("/convert", "Converted to sale — invoice created")}
        />
      )}

      {status === "CONVERTED" && (
        <Button render={<Link href={`/invoices/${quotationId}`} />}>
          <Receipt />
          View Invoice
        </Button>
      )}

      {(status === "APPROVED" || status === "CONVERTED") && (
        <Button variant="outline" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      )}
    </div>
  );
}
