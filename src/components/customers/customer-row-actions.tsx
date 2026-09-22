"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function CustomerRowActions({
  customerId,
  name,
  isActive,
  canManage,
}: {
  customerId: string;
  name: string;
  isActive: boolean;
  canManage: boolean;
}) {
  const router = useRouter();

  async function toggleActive() {
    const response = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(isActive ? "Customer deactivated" : "Customer reactivated");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" render={<Link href={`/customers/${customerId}`} />}>
        <Eye />
      </Button>
      {canManage && (
        <Button variant="ghost" size="icon-sm" render={<Link href={`/customers/${customerId}/edit`} />}>
          <Pencil />
        </Button>
      )}
      {canManage && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm">
              <Power />
            </Button>
          }
          title={isActive ? "Deactivate customer?" : "Reactivate customer?"}
          description={
            isActive
              ? `"${name}" will no longer appear in active customer lists or be selectable in new quotations.`
              : `"${name}" will become available again in active customer lists.`
          }
          confirmLabel={isActive ? "Deactivate" : "Reactivate"}
          destructive={isActive}
          onConfirm={toggleActive}
        />
      )}
    </div>
  );
}
