import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { supplierSearchQuerySchema } from "@/lib/validation/supplier";
import { searchSuppliers } from "@/services/supplier.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "suppliers.read");
    const query = supplierSearchQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return searchSuppliers(session.organizationId, query.q, query.limit);
  });
}
