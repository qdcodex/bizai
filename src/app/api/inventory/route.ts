import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { inventoryQuerySchema } from "@/lib/validation/inventory";
import { listInventory } from "@/services/inventory.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "inventory.read");
    const query = inventoryQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return listInventory(session.organizationId, query);
  });
}
