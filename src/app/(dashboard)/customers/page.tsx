import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/empty-state";
import { CustomerRowActions } from "@/components/customers/customer-row-actions";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { customerQuerySchema } from "@/lib/validation/customer";
import { flattenSearchParams } from "@/lib/validation/pagination";
import { listCustomers } from "@/services/customer.service";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("customers.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = customerQuerySchema.parse(rawParams);

  const { data: customers, pagination } = await listCustomers(session.organizationId, query);
  const canManage = can(session.role, "customers.create");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage your customer accounts.</p>
        </div>
        {canManage && (
          <Button render={<Link href="/customers/new" />}>
            <Plus />
            Add Customer
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
          {customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers found"
              description="Try adjusting your filters, or add your first customer to get started."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Code</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer._id.toString()}>
                      <TableCell className="font-mono text-xs">{customer.customerCode}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.companyName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.paymentTerms}</TableCell>
                      <TableCell>
                        <StatusBadge status={customer.isActive ? "ACTIVE" : "INACTIVE"} />
                      </TableCell>
                      <TableCell>
                        <CustomerRowActions
                          customerId={customer._id.toString()}
                          name={customer.name}
                          isActive={customer.isActive}
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
