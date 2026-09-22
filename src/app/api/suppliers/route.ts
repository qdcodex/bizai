import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { supplierCreateSchema, supplierQuerySchema } from "@/lib/validation/supplier";
import { createSupplier, listSuppliers } from "@/services/supplier.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "suppliers.read");
    const query = supplierQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return listSuppliers(session.organizationId, query);
  });
}

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "suppliers.create");
    const body = supplierCreateSchema.parse(await request.json());
    return createSupplier(session.organizationId, body);
  }, 201);
}
