import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { supplierUpdateSchema } from "@/lib/validation/supplier";
import { deactivateSupplier, getSupplier, updateSupplier } from "@/services/supplier.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "suppliers.read");
    const { id } = await params;
    return getSupplier(session.organizationId, id);
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "suppliers.update");
    const { id } = await params;
    const body = supplierUpdateSchema.parse(await request.json());
    return updateSupplier(session.organizationId, id, body);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "suppliers.delete");
    const { id } = await params;
    return deactivateSupplier(session.organizationId, id);
  });
}
