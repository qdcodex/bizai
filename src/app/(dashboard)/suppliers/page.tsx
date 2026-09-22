import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/empty-state";
import { SupplierRowActions } from "@/components/suppliers/supplier-row-actions";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { supplierQuerySchema } from "@/lib/validation/supplier";
import { flattenSearchParams } from "@/lib/validation/pagination";
import { listSuppliers } from "@/services/supplier.service";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("suppliers.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = supplierQuerySchema.parse(rawParams);

  const { data: suppliers, pagination } = await listSuppliers(session.organizationId, query);
  const canManage = can(session.role, "suppliers.create");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage the suppliers you purchase from.</p>
        </div>
        {canManage && (
          <Button render={<Link href="/suppliers/new" />}>
            <Plus />
            Add Supplier
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by name, code, email, phone..." />
        <FilterSelect
          paramName="status"
          placeholder="Status"
          defaultValue="active"
          options={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "All", value: "all" },
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No suppliers found"
              description="Try adjusting your filters, or add your first supplier to get started."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Code</TableHead>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier._id.toString()}>
                      <TableCell className="font-mono text-xs">{supplier.supplierCode}</TableCell>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.companyName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.paymentTerms}</TableCell>
                      <TableCell>
                        <StatusBadge status={supplier.isActive ? "ACTIVE" : "INACTIVE"} />
                      </TableCell>
                      <TableCell>
                        <SupplierRowActions
                          supplierId={supplier._id.toString()}
                          name={supplier.name}
                          isActive={supplier.isActive}
                          canManage={canManage}
                        />
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
