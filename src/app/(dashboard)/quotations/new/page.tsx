import { QuotationForm } from "@/components/quotations/quotation-form";
import { requirePagePermission } from "@/lib/auth/permissions";

export default async function NewQuotationPage() {
  await requirePagePermission("quotations.create");
  return (
    <div className="mx-auto w-full max-w-4xl">
      <QuotationForm />
    </div>
  );
}
