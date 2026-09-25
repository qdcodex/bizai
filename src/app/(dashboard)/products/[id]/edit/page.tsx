import { notFound } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { getProduct } from "@/services/product.service";
import { AppError } from "@/lib/errors";
import type { ProductDocument } from "@/models/Product";
import { BackLink } from "@/components/shared/back-link";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("products.update");
  const { id } = await params;

  let product: ProductDocument;
  try {
    product = await getProduct(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "PRODUCT_NOT_FOUND") notFound();
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <BackLink href={`/products/${id}`} label="Back to product" />
      <ProductForm
        mode="edit"
        productId={id}
        defaultValues={{
          itemCode: product.itemCode,
          itemName: product.itemName,
          description: product.description,
          category: product.category,
          brand: product.brand,
          partNumber: product.partNumber,
          uom: product.uom,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          minSellingPrice: product.minSellingPrice,
          lowStockThreshold: product.lowStockThreshold,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
        }}
      />
    </div>
  );
}
