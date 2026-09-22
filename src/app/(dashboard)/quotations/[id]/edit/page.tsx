import { notFound, redirect } from "next/navigation";
import { QuotationEditForm } from "@/components/quotations/quotation-edit-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getQuotation } from "@/services/quotation.service";
import { AppError } from "@/lib/errors";
import type { DraftLine } from "@/components/quotations/quotation-line-items";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("quotations.update");
  const { id } = await params;

  let quotation;
  try {
    quotation = await getQuotation(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "QUOTATION_NOT_FOUND") notFound();
    throw error;
  }

  if (quotation.status !== "DRAFT") {
    redirect(`/quotations/${id}`);
  }

  const initialLines: DraftLine[] = quotation.items.map((item) => ({
    key: item.productId.toString(),
    productId: item.productId.toString(),
    itemCode: item.itemCode,
    itemName: item.itemName,
    uom: item.uom,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    minSellingPrice: 0,
    discount: item.discount,
    tax: item.tax,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <QuotationEditForm
        quotationId={id}
        initialCustomer={{
          customerId: quotation.customer?.id ?? "",
          customerCode: quotation.customer?.customerCode ?? "",
          name: quotation.customer?.name ?? "",
          companyName: "",
        }}
        initialLines={initialLines}
        initialValidUntil={quotation.validUntil ? quotation.validUntil.slice(0, 10) : ""}
        initialNotes={quotation.notes}
      />
    </div>
  );
}
