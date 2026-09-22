"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { ActionCard, type ConfirmableToolOutput } from "@/components/assistant/action-card";
import type { QuotationPreview } from "@/services/quotation.service";

export interface CreateQuotationToolInput {
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice?: number }>;
  notes?: string;
}

export type CreateQuotationToolOutput = ConfirmableToolOutput<QuotationPreview>;

export function QuotationPreviewCard({ output }: { output: CreateQuotationToolOutput }) {
  return (
    <ActionCard
      output={output}
      icon={FileText}
      title="Quotation Ready"
      confirmLabel="Confirm & Create"
      confirmDisabled={(preview) => ({
        disabled: preview.hasItemsBelowMinPrice && !preview.canOverrideMinPrice,
        reason:
          preview.hasItemsBelowMinPrice && !preview.canOverrideMinPrice
            ? "One or more items are priced below the minimum selling price. Creating this quotation requires an authorized user to override it."
            : undefined,
      })}
      renderCompletedExtra={(data) =>
        data?.quotationId ? (
          <Button variant="outline" size="sm" render={<Link href={`/quotations/${data.quotationId}`} />}>
            View
          </Button>
        ) : null
      }
      renderPreview={(preview) => (
        <>
          <div className="text-sm">
            <span className="text-muted-foreground">Customer: </span>
            <span className="font-medium">{preview.customer.name}</span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell>
                    <div className="font-medium">{item.itemName}</div>
                    {item.belowMinPrice && (
                      <Badge variant="secondary" className="mt-1 bg-amber-50 text-amber-700">
                        Below min. price
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={item.unitPrice} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyDisplay value={item.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-1 self-end text-sm">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Subtotal</span>
              <MoneyDisplay value={preview.subtotal} />
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Tax</span>
              <MoneyDisplay value={preview.tax} />
            </div>
            <div className="flex justify-between gap-6 border-t pt-1 font-semibold">
              <span>Total</span>
              <MoneyDisplay value={preview.total} />
            </div>
          </div>

          {preview.requiresApproval && (
            <p className="text-xs text-amber-700">
              This total is over the approval threshold and will need to be approved before it can be converted.
            </p>
          )}
        </>
      )}
    />
  );
}
