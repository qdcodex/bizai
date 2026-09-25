import { ProductForm } from "@/components/products/product-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { BackLink } from "@/components/shared/back-link";

export default async function NewProductPage() {
  await requirePagePermission("products.create");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <BackLink href="/products" label="Products" />
      <ProductForm mode="create" />
    </div>
  );
}
