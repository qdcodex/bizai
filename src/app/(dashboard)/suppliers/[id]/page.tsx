import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { getSupplier } from "@/services/supplier.service";
import { AppError } from "@/lib/errors";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("suppliers.read");
  const { id } = await params;

  let supplier;
  try {
    supplier = await getSupplier(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "SUPPLIER_NOT_FOUND") notFound();
    throw error;
  }

  const canManage = can(session.role, "suppliers.update");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/suppliers" />}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
            <p className="font-mono text-sm text-muted-foreground">{supplier.supplierCode}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" render={<Link href={`/suppliers/${id}/edit`} />}>
            <Pencil />
            Edit
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" value={supplier.companyName || "—"} />
          <Field label="Status" value={<StatusBadge status={supplier.isActive ? "ACTIVE" : "INACTIVE"} />} />
          <Field label="Email" value={supplier.email || "—"} />
          <Field label="Phone" value={supplier.phone || "—"} />
          <Field label="Tax Number" value={supplier.taxNumber || "—"} />
          <Field label="Payment Terms" value={supplier.paymentTerms} />
          <Field
            label="Address"
            value={
              [supplier.address, supplier.city, supplier.state, supplier.country, supplier.postalCode]
                .filter(Boolean)
                .join(", ") || "—"
            }
          />
        </CardContent>
      </Card>
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
