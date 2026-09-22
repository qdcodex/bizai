import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { customerSearchQuerySchema } from "@/lib/validation/customer";
import { searchCustomers } from "@/services/customer.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "customers.read");
    const query = customerSearchQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return searchCustomers(session.organizationId, query.q, query.limit);
  });
}
