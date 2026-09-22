import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { stockAdjustmentSchema, stockMovementQuerySchema } from "@/lib/validation/inventory";
import { listStockMovements, recordStockMovement } from "@/services/stock-movement.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "inventory.read");
    const query = stockMovementQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return listStockMovements(session.organizationId, query);
  });
}

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "inventory.adjust");
    const body = stockAdjustmentSchema.parse(await request.json());

    return recordStockMovement({
      organizationId: session.organizationId,
      productId: body.productId,
      type: body.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      quantity: body.quantity,
      referenceType: "MANUAL",
      notes: body.notes,
      createdBy: session.userId,
    });
  }, 201);
}
