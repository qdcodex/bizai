import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getCustomer } from "@/services/customer.service";
import { AppError } from "@/lib/errors";
import type { CustomerDocument } from "@/models/Customer";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("customers.update");
  const { id } = await params;

  let customer: CustomerDocument;
  try {
    customer = await getCustomer(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "CUSTOMER_NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CustomerForm
        mode="edit"
        customerId={id}
        defaultValues={{
          customerCode: customer.customerCode,
          name: customer.name,
          companyName: customer.companyName,
          email: customer.email,
          phone: customer.phone,
          taxNumber: customer.taxNumber,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          country: customer.country,
          postalCode: customer.postalCode,
          creditLimit: customer.creditLimit,
          paymentTerms: customer.paymentTerms,
          isActive: customer.isActive,
        }}
      />
    </div>
  );
}
