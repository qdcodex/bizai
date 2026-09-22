import { ProductForm } from "@/components/products/product-form";
import { requirePagePermission } from "@/lib/auth/permissions";

export default async function NewProductPage() {
  await requirePagePermission("products.create");
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ProductForm mode="create" />
    </div>
  );
}
