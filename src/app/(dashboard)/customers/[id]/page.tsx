import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { EmptyState } from "@/components/empty-state";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { getCustomer, getCustomerPurchaseHistory } from "@/services/customer.service";
import { AppError } from "@/lib/errors";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("customers.read");
  const { id } = await params;

  let customer;
  try {
    customer = await getCustomer(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "CUSTOMER_NOT_FOUND") notFound();
    throw error;
  }

  const purchaseHistory = await getCustomerPurchaseHistory(session.organizationId, id);
  const canManage = can(session.role, "customers.update");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/customers" />}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <p className="font-mono text-sm text-muted-foreground">{customer.customerCode}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" render={<Link href={`/customers/${id}/edit`} />}>
            <Pencil />
            Edit
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Company" value={customer.companyName || "—"} />
              <Field label="Status" value={<StatusBadge status={customer.isActive ? "ACTIVE" : "INACTIVE"} />} />
              <Field label="Email" value={customer.email || "—"} />
              <Field label="Phone" value={customer.phone || "—"} />
              <Field label="Tax Number" value={customer.taxNumber || "—"} />
              <Field label="Payment Terms" value={customer.paymentTerms} />
              <Field label="Credit Limit" value={<MoneyDisplay value={customer.creditLimit} />} />
              <Field
                label="Address"
                value={
                  [customer.address, customer.city, customer.state, customer.country, customer.postalCode]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {purchaseHistory.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No quotations yet"
                  description="Quotations created for this customer will appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseHistory.map((entry) => (
                      <TableRow key={entry.quotationId}>
                        <TableCell>
                          <Link href={`/quotations/${entry.quotationId}`} className="font-mono text-xs hover:underline">
                            {entry.quotationNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <MoneyDisplay value={entry.total} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
