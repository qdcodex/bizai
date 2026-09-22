import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { z } from "zod";
import { searchQuotations } from "@/services/quotation.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

const quickSearchSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "quotations.read");
    const query = quickSearchSchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return searchQuotations(session.organizationId, { q: query.q, limit: query.limit });
  });
}
