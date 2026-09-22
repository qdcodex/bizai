"use client";

import Link from "next/link";
import { Boxes, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionCard, type ConfirmableToolOutput } from "@/components/assistant/action-card";
import type { StockAdjustmentPreview } from "@/services/inventory.service";

export interface AdjustStockToolInput {
  productId: string;
  direction: "IN" | "OUT";
  quantity: number;
  notes?: string;
}

export type AdjustStockToolOutput = ConfirmableToolOutput<StockAdjustmentPreview>;

export function StockAdjustmentCard({ output }: { output: AdjustStockToolOutput }) {
  return (
    <ActionCard
      output={output}
      icon={Boxes}
      title="Stock Adjustment Ready"
      confirmLabel="Confirm & Adjust"
      confirmDisabled={(preview) => ({
        disabled: preview.direction === "OUT" && preview.newStock < 0,
        reason:
          preview.direction === "OUT" && preview.newStock < 0
            ? `Not enough stock: only ${preview.currentStock} units available.`
            : undefined,
      })}
      renderCompletedExtra={() => (
        <Button variant="outline" size="sm" render={<Link href="/inventory" />}>
          View Inventory
        </Button>
      )}
      renderPreview={(preview) => (
        <>
          <div className="text-sm">
            <span className="font-medium">{preview.product.itemName}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground">{preview.product.itemCode}</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={preview.direction === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
              {preview.direction === "IN" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {preview.direction === "IN" ? "Increase" : "Decrease"} by {preview.quantity} {preview.product.uom}
            </Badge>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Current Stock</span>
              <span>{preview.currentStock}</span>
            </div>
            <div className="flex justify-between gap-6 border-t pt-1 font-semibold">
              <span>New Stock</span>
              <span>{preview.newStock}</span>
            </div>
          </div>

          {preview.notes && (
            <div>
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="text-sm">{preview.notes}</p>
            </div>
          )}
        </>
      )}
    />
  );
}
