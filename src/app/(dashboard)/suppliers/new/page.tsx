import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { BackLink } from "@/components/shared/back-link";

export default async function NewSupplierPage() {
  await requirePagePermission("suppliers.create");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <BackLink href="/suppliers" label="Suppliers" />
      <SupplierForm mode="create" />
    </div>
  );
}
