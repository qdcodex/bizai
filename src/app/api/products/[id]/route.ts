import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { productUpdateSchema } from "@/lib/validation/product";
import { deactivateProduct, getProduct, updateProduct } from "@/services/product.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "products.read");
    const { id } = await params;
    return getProduct(session.organizationId, id);
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "products.update");
    const { id } = await params;
    const body = productUpdateSchema.parse(await request.json());
    return updateProduct(session.organizationId, id, body);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "products.delete");
    const { id } = await params;
    return deactivateProduct(session.organizationId, id);
  });
}
