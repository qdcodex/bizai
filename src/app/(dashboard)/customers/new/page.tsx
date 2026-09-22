import { CustomerForm } from "@/components/customers/customer-form";
import { requirePagePermission } from "@/lib/auth/permissions";

export default async function NewCustomerPage() {
  await requirePagePermission("customers.create");
  return (
    <div className="mx-auto w-full max-w-3xl">
      <CustomerForm mode="create" />
    </div>
  );
}
