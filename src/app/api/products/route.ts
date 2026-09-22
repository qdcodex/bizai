import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { productCreateSchema, productQuerySchema } from "@/lib/validation/product";
import { createProduct, listProducts } from "@/services/product.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "products.read");
    const query = productQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return listProducts(session.organizationId, query);
  });
}

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "products.create");
    const body = productCreateSchema.parse(await request.json());
    return createProduct(session.organizationId, body);
  }, 201);
}
