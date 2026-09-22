"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function ProductRowActions({
  productId,
  itemName,
  isActive,
  canManage,
}: {
  productId: string;
  itemName: string;
  isActive: boolean;
  canManage: boolean;
}) {
  const router = useRouter();

  async function toggleActive() {
    const response = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(isActive ? "Product deactivated" : "Product reactivated");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" render={<Link href={`/products/${productId}`} />}>
        <Eye />
      </Button>
      {canManage && (
        <Button variant="ghost" size="icon-sm" render={<Link href={`/products/${productId}/edit`} />}>
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
          title={isActive ? "Deactivate product?" : "Reactivate product?"}
          description={
            isActive
              ? `"${itemName}" will no longer appear in active product lists or be selectable in new quotations.`
              : `"${itemName}" will become available again in active product lists.`
          }
          confirmLabel={isActive ? "Deactivate" : "Reactivate"}
          destructive={isActive}
          onConfirm={toggleActive}
        />
      )}
    </div>
  );
}
