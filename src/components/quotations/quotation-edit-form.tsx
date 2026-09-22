"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CustomerSelector } from "@/components/customers/customer-selector";
import { QuotationLineItems, lineTotal, type DraftLine } from "@/components/quotations/quotation-line-items";
import { MoneyDisplay } from "@/components/shared/money";
import type { CustomerSearchResult } from "@/services/customer.service";

export function QuotationEditForm({
  quotationId,
  initialCustomer,
  initialLines,
  initialValidUntil,
  initialNotes,
}: {
  quotationId: string;
  initialCustomer: CustomerSearchResult;
  initialLines: DraftLine[];
  initialValidUntil: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerSearchResult>(initialCustomer);
  const [lines, setLines] = useState<DraftLine[]>(initialLines);
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const [notes, setNotes] = useState(initialNotes);
  const [overrideMinPrice, setOverrideMinPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const discount = lines.reduce((sum, l) => sum + l.discount, 0);
    const tax = lines.reduce((sum, l) => sum + l.tax, 0);
    const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
    return { subtotal, discount, tax, total };
  }, [lines]);

  const hasBelowMinPrice = lines.some((l) => l.unitPrice < l.minSellingPrice);

  async function handleSave() {
    if (lines.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.customerId,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            tax: l.tax,
          })),
          validUntil: validUntil || null,
          notes,
          overrideMinPrice,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Quotation updated");
      router.push(`/quotations/${quotationId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Quotation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Customer</Label>
            <CustomerSelector label={customer.name} onSelect={setCustomer} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Items</Label>
          <QuotationLineItems lines={lines} onChange={setLines} />
        </div>

        {hasBelowMinPrice && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={overrideMinPrice}
              onChange={(e) => setOverrideMinPrice(e.target.checked)}
              className="size-4"
            />
            I am authorized to override the minimum selling price on the highlighted line(s).
          </label>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <MoneyDisplay value={totals.subtotal} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <MoneyDisplay value={totals.discount} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <MoneyDisplay value={totals.tax} />
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <MoneyDisplay value={totals.total} />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={submitting} onClick={handleSave}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
}
