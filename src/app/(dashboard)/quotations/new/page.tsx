import { QuotationForm } from "@/components/quotations/quotation-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { BackLink } from "@/components/shared/back-link";

export default async function NewQuotationPage() {
  await requirePagePermission("quotations.create");
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <BackLink href="/quotations" label="Quotations" />
      <QuotationForm />
    </div>
  );
}
