import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { customerUpdateSchema } from "@/lib/validation/customer";
import { deactivateCustomer, getCustomer, updateCustomer } from "@/services/customer.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "customers.read");
    const { id } = await params;
    return getCustomer(session.organizationId, id);
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "customers.update");
    const { id } = await params;
    const body = customerUpdateSchema.parse(await request.json());
    return updateCustomer(session.organizationId, id, body);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "customers.delete");
    const { id } = await params;
    return deactivateCustomer(session.organizationId, id);
  });
}
