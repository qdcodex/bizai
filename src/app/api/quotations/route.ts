import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { quotationQuerySchema } from "@/lib/validation/quotation";
import { createQuotation, listQuotations } from "@/services/quotation.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "quotations.read");
    const query = quotationQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return listQuotations(session.organizationId, query);
  });
}

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const body = await request.json();
    return createQuotation(session, body);
  }, 201);
}
