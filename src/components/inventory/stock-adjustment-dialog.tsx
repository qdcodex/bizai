"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductSelector } from "@/components/products/product-selector";
import type { ProductSearchResult } from "@/services/product.service";

export function StockAdjustmentDialog({
  fixedProduct,
  trigger,
}: {
  fixedProduct?: { productId: string; itemName: string };
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [product, setProduct] = useState<{ productId: string; itemName: string } | null>(
    fixedProduct ?? null,
  );
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    if (!product) {
      toast.error("Select a product first.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.productId, direction, quantity: Number(quantity), notes }),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Stock updated");
      setOpen(false);
      setNotes("");
      setQuantity("1");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <PackagePlus />
              Adjust Stock
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Record a manual stock increase or decrease. This creates an audited stock movement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!fixedProduct && (
            <div className="flex flex-col gap-2">
              <Label>Product</Label>
              <ProductSelector
                label={product?.itemName}
                onSelect={(p: ProductSearchResult) =>
                  setProduct({ productId: p.productId, itemName: p.itemName })
                }
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as "IN" | "OUT")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">Stock In (Adjustment)</SelectItem>
                <SelectItem value="OUT">Stock Out (Adjustment)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
