import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { getQuotation } from "@/services/quotation.service";
import { AppError } from "@/lib/errors";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("quotations.read");
  const { id } = await params;

  let quotation;
  try {
    quotation = await getQuotation(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "QUOTATION_NOT_FOUND") notFound();
    throw error;
  }

  const canUpdate = can(session.role, "quotations.update");
  const canApprove = can(session.role, "quotations.approve");
  const canDelete = can(session.role, "quotations.delete");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/quotations" />}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{quotation.quotationNumber}</h1>
            <p className="text-sm text-muted-foreground">{quotation.customer?.name ?? "Unknown customer"}</p>
          </div>
        </div>
        <QuotationActions
          quotationId={id}
          status={quotation.status}
          canUpdate={canUpdate}
          canApprove={canApprove}
          canDelete={canDelete}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Quotation Details</CardTitle>
            <StatusBadge status={quotation.status} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Field label="Customer" value={quotation.customer?.name ?? "—"} />
          <Field label="Customer Code" value={quotation.customer?.customerCode ?? "—"} />
          <Field
            label="Valid Until"
            value={quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "—"}
          />
          <Field label="Created" value={new Date(quotation.createdAt).toLocaleDateString()} />
          <Field label="Created By" value={quotation.createdBy?.name ?? "—"} />
          <Field label="Approved By" value={quotation.approvedBy?.name ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="font-medium">{item.itemName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{item.itemCode}</div>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.uom}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={item.unitPrice} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={item.discount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={item.tax} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyDisplay value={item.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <div className="flex w-full max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <MoneyDisplay value={quotation.subtotal} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <MoneyDisplay value={quotation.discount} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <MoneyDisplay value={quotation.tax} />
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>Total</span>
            <MoneyDisplay value={quotation.total} />
          </div>
        </div>
      </div>

      {quotation.notes && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{quotation.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
