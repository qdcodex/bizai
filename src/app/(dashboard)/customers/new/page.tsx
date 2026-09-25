import { CustomerForm } from "@/components/customers/customer-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { BackLink } from "@/components/shared/back-link";

export default async function NewCustomerPage() {
  await requirePagePermission("customers.create");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <BackLink href="/customers" label="Customers" />
      <CustomerForm mode="create" />
    </div>
  );
}
