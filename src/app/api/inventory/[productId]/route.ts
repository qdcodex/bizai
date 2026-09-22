import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { getInventoryDetail } from "@/services/inventory.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ productId: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "inventory.read");
    const { productId } = await params;
    return getInventoryDetail(session.organizationId, productId);
  });
}
