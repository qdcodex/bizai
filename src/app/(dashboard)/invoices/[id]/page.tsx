import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/shared/money";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getQuotation } from "@/services/quotation.service";
import { getWorkspaceContext } from "@/services/workspace.service";
import { AppError } from "@/lib/errors";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("quotations.read");
  const { id } = await params;

  let invoice;
  try {
    invoice = await getQuotation(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "QUOTATION_NOT_FOUND") notFound();
    throw error;
  }
  if (invoice.status !== "CONVERTED") notFound();

  const workspace = await getWorkspaceContext(session);
  const customer = invoice.customer;
  const cityLine = [customer?.city, customer?.state, customer?.postalCode].filter(Boolean).join(", ");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon-sm" render={<Link href="/invoices" />}>
          <ArrowLeft />
        </Button>
        <InvoiceActions quotationId={id} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">{workspace.organization.name}</h1>
              <p className="text-sm text-muted-foreground">Invoice</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-semibold">{invoice.quotationNumber}</p>
              <p className="text-xs text-muted-foreground">Date: {new Date(invoice.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Bill To</p>
            <p className="font-medium">{customer?.name ?? "Unknown customer"}</p>
            {customer?.companyName && <p className="text-sm text-muted-foreground">{customer.companyName}</p>}
            {customer?.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
            {cityLine && <p className="text-sm text-muted-foreground">{cityLine}</p>}
            {customer?.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
            {customer?.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="font-medium">{item.itemName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{item.itemCode}</div>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
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

          <div className="flex justify-end">
            <div className="flex w-full max-w-xs flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <MoneyDisplay value={invoice.subtotal} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <MoneyDisplay value={invoice.discount} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <MoneyDisplay value={invoice.tax} />
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-semibold">
                <span>Total</span>
                <MoneyDisplay value={invoice.total} />
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="print:hidden">
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
