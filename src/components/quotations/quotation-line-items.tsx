"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductSelector } from "@/components/products/product-selector";
import { MoneyDisplay } from "@/components/shared/money";
import type { ProductSearchResult } from "@/services/product.service";

export interface DraftLine {
  key: string;
  productId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  minSellingPrice: number;
  discount: number;
  tax: number;
}

export function lineTotal(line: DraftLine): number {
  return Math.max(0, line.quantity * line.unitPrice - line.discount + line.tax);
}

export function QuotationLineItems({
  lines,
  onChange,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
}) {
  function updateLine(key: string, patch: Partial<DraftLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    onChange(lines.filter((line) => line.key !== key));
  }

  function addLine(product: ProductSearchResult) {
    onChange([
      ...lines,
      {
        key: crypto.randomUUID(),
        productId: product.productId,
        itemCode: product.itemCode,
        itemName: product.itemName,
        uom: product.uom,
        quantity: 1,
        unitPrice: product.sellingPrice,
        minSellingPrice: product.minSellingPrice,
        discount: 0,
        tax: 0,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="w-20 text-right">Qty</TableHead>
            <TableHead className="w-28 text-right">Price</TableHead>
            <TableHead className="w-24 text-right">Discount</TableHead>
            <TableHead className="w-24 text-right">Tax</TableHead>
            <TableHead className="w-32 text-right">Line Total</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.key}>
              <TableCell>
                <div className="font-medium">{line.itemName}</div>
                <div className="font-mono text-xs text-muted-foreground">{line.itemCode}</div>
                {line.unitPrice < line.minSellingPrice && (
                  <p className="text-xs text-destructive">
                    Below min. price <MoneyDisplay value={line.minSellingPrice} />
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  aria-label={`Quantity for ${line.itemName}`}
                  onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) || 1 })}
                  className="min-w-16 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={line.unitPrice}
                  aria-label={`Unit price for ${line.itemName}`}
                  onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })}
                  className="min-w-16 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={line.discount}
                  aria-label={`Discount for ${line.itemName}`}
                  onChange={(e) => updateLine(line.key, { discount: Number(e.target.value) || 0 })}
                  className="min-w-16 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={line.tax}
                  aria-label={`Tax for ${line.itemName}`}
                  onChange={(e) => updateLine(line.key, { tax: Number(e.target.value) || 0 })}
                  className="min-w-16 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </TableCell>
              <TableCell className="text-right font-medium">
                <MoneyDisplay value={lineTotal(line)} />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${line.itemName}`}
                  onClick={() => removeLine(line.key)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                No items added yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ProductSelector placeholder="Add a product..." onSelect={addLine} />
    </div>
  );
}
