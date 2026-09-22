import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { getCustomerPurchaseHistory } from "@/services/customer.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "customers.read");
    const { id } = await params;
    return getCustomerPurchaseHistory(session.organizationId, id);
  });
}
