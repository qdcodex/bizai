import Link from "next/link";
import { Receipt, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { MoneyDisplay } from "@/components/shared/money";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/permissions";
import { paginationQuerySchema, flattenSearchParams } from "@/lib/validation/pagination";
import { listQuotations } from "@/services/quotation.service";
import { z } from "zod";

const invoiceQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
});

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("quotations.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = invoiceQuerySchema.parse(rawParams);

  const { data: invoices, pagination } = await listQuotations(session.organizationId, {
    ...query,
    status: "CONVERTED",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Every converted quotation becomes an invoice here — the quotation number is the invoice number.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by invoice number..." />
      </div>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="Invoices appear here once an approved quotation is converted to a sale."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Converted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.quotationId}>
                      <TableCell className="font-mono text-xs">{invoice.quotationNumber}</TableCell>
                      <TableCell className="font-medium">{invoice.customerName}</TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={invoice.total} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          render={<Link href={`/invoices/${invoice.quotationId}`} />}
                        >
                          <Eye />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar pagination={pagination} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
