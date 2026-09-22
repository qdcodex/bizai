import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getSupplier } from "@/services/supplier.service";
import { AppError } from "@/lib/errors";
import type { SupplierDocument } from "@/models/Supplier";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("suppliers.update");
  const { id } = await params;

  let supplier: SupplierDocument;
  try {
    supplier = await getSupplier(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "SUPPLIER_NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SupplierForm
        mode="edit"
        supplierId={id}
        defaultValues={{
          supplierCode: supplier.supplierCode,
          name: supplier.name,
          companyName: supplier.companyName,
          email: supplier.email,
          phone: supplier.phone,
          taxNumber: supplier.taxNumber,
          address: supplier.address,
          city: supplier.city,
          state: supplier.state,
          country: supplier.country,
          postalCode: supplier.postalCode,
          paymentTerms: supplier.paymentTerms,
          isActive: supplier.isActive,
        }}
      />
    </div>
  );
}
