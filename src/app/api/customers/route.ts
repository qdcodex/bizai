import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { customerCreateSchema, customerQuerySchema } from "@/lib/validation/customer";
import { createCustomer, listCustomers } from "@/services/customer.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "customers.read");
    const query = customerQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return listCustomers(session.organizationId, query);
  });
}

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "customers.create");
    const body = customerCreateSchema.parse(await request.json());
    return createCustomer(session.organizationId, body);
  }, 201);
}
