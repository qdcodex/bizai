import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { EmptyState } from "@/components/empty-state";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { quotationQuerySchema } from "@/lib/validation/quotation";
import { flattenSearchParams } from "@/lib/validation/pagination";
import { listQuotations } from "@/services/quotation.service";
import { QUOTATION_STATUSES } from "@/models/Quotation";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("quotations.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = quotationQuerySchema.parse(rawParams);

  const { data: quotations, pagination } = await listQuotations(session.organizationId, query);
  const canCreate = can(session.role, "quotations.create");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">Create and track customer quotations.</p>
        </div>
        {canCreate && (
          <Button render={<Link href="/quotations/new" />}>
            <Plus />
            New Quotation
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by quotation number..." />
        <FilterSelect
          paramName="status"
          placeholder="Status"
          options={[
            { label: "All Statuses", value: "all" },
            ...QUOTATION_STATUSES.map((s) => ({ label: s.replace("_", " "), value: s })),
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {quotations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No quotations found"
              description="Try adjusting your filters, or create your first quotation."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
                    <TableRow key={quotation.quotationId}>
                      <TableCell>
                        <Link
                          href={`/quotations/${quotation.quotationId}`}
                          className="font-mono text-xs font-medium hover:underline"
                        >
                          {quotation.quotationNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{quotation.customerName}</TableCell>
                      <TableCell>
                        <StatusBadge status={quotation.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={quotation.total} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(quotation.createdAt).toLocaleDateString()}
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
