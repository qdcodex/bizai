"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Printer } from "lucide-react";
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

  async function post(path: string, body?: unknown) {
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
      toast.success("Quotation updated");
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
          <Button disabled={pendingAction !== null} onClick={() => post("/submit")}>
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
          <Button disabled={pendingAction !== null} onClick={() => post("/approve")}>
            {isBusy("/approve") ? <Loader2 className="animate-spin" /> : null}
            Approve
          </Button>
          <ConfirmDialog
            trigger={<Button variant="outline">Reject</Button>}
            title="Reject this quotation?"
            description="The requester will need to revise and resubmit it."
            confirmLabel="Reject"
            destructive
            onConfirm={() => post("/reject")}
          />
        </>
      )}

      {status === "APPROVED" && canUpdate && (
        <Button disabled={pendingAction !== null} onClick={() => post("/convert")}>
          {isBusy("/convert") ? <Loader2 className="animate-spin" /> : null}
          Convert to Sale
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
