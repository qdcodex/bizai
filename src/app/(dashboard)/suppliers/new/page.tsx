import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requirePagePermission } from "@/lib/auth/permissions";

export default async function NewSupplierPage() {
  await requirePagePermission("suppliers.create");
  return (
    <div className="mx-auto w-full max-w-3xl">
      <SupplierForm mode="create" />
    </div>
  );
}
