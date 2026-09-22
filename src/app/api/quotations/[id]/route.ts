import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { deleteQuotation, getQuotation, updateQuotation } from "@/services/quotation.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "quotations.read");
    const { id } = await params;
    return getQuotation(session.organizationId, id);
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json();
    return updateQuotation(session, id, body);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    return deleteQuotation(session, id);
  });
}
