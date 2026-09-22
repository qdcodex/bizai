import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { productSearchQuerySchema } from "@/lib/validation/product";
import { searchProducts } from "@/services/product.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "products.read");
    const query = productSearchQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return searchProducts(session.organizationId, query.q, query.limit);
  });
}
