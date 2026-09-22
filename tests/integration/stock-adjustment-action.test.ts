import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization } from "../helpers/db";
import { createProduct } from "@/services/product.service";
import { recordStockMovement } from "@/services/stock-movement.service";
import { createInventoryTools } from "@/ai/tools/inventory-tools";
import { confirmPendingAction, cancelPendingAction } from "@/ai/actions/action-manager";
import { PendingAction } from "@/models/PendingAction";
import { InventoryItem } from "@/models/InventoryItem";
import type { ToolContext } from "@/ai/types";
import type { SessionPayload } from "@/lib/auth/session";

async function callAdjustStock(context: ToolContext, input: unknown) {
  const tools = createInventoryTools(context);
  const execute = tools.adjustStock.execute as (input: unknown, options: unknown) => Promise<{
    status: string;
    actionId?: string;
    message?: string;
  }>;
  return execute(input, {});
}

describe("adjustStock action lifecycle", () => {
  let orgId: string;
  let context: ToolContext;
  let session: SessionPayload;
  let productId: string;

  beforeAll(async () => {
    await setupTestDb();
    const org = await createTestOrganization("Stock Adjustment Org");
    orgId = org.organizationId;
    context = {
      organizationId: orgId,
      userId: org.userId,
      role: "owner",
      conversationId: "000000000000000000000030",
    };
    session = { organizationId: orgId, userId: org.userId, role: "owner" };

    const product = await createProduct(orgId, {
      itemCode: "STOCK-ADJ-1",
      itemName: "Adjustable Widget",
      description: "",
      category: "",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: 50,
      sellingPrice: 100,
      minSellingPrice: 75,
      lowStockThreshold: 5,
      imageUrl: "",
      isActive: true,
    });
    productId = product._id.toString();

    await recordStockMovement({
      organizationId: orgId,
      productId,
      type: "PURCHASE",
      quantity: 20,
      createdBy: org.userId,
    });
  });

  it("proposing an adjustment never writes to InventoryItem", async () => {
    const before = await InventoryItem.findOne({ organizationId: orgId, productId });
    const result = await callAdjustStock(context, { productId, direction: "IN", quantity: 5 });
    expect(result.status).toBe("pending_confirmation");

    const after = await InventoryItem.findOne({ organizationId: orgId, productId });
    expect(after?.currentStock).toBe(before?.currentStock);

    const pending = await PendingAction.findById(result.actionId);
    expect(pending?.actionType).toBe("ADJUST_STOCK");
    expect(pending?.status).toBe("PENDING_CONFIRMATION");
  });

  it("confirming an IN adjustment increases stock exactly once, even if confirmed twice", async () => {
    const before = await InventoryItem.findOne({ organizationId: orgId, productId });
    const result = await callAdjustStock(context, { productId, direction: "IN", quantity: 10, notes: "found extra units" });
    const actionId = result.actionId!;

    const first = await confirmPendingAction(session, actionId);
    const second = await confirmPendingAction(session, actionId);

    expect(first.status).toBe("COMPLETED");
    expect(second.status).toBe("COMPLETED");
    expect(second.data?.newStock).toBe(first.data?.newStock);

    const after = await InventoryItem.findOne({ organizationId: orgId, productId });
    expect(after?.currentStock).toBe((before?.currentStock ?? 0) + 10);
  });

  it("confirming an OUT adjustment decreases stock", async () => {
    const before = await InventoryItem.findOne({ organizationId: orgId, productId });
    const result = await callAdjustStock(context, { productId, direction: "OUT", quantity: 3, notes: "damaged units" });
    const confirmResult = await confirmPendingAction(session, result.actionId!);

    expect(confirmResult.status).toBe("COMPLETED");
    const after = await InventoryItem.findOne({ organizationId: orgId, productId });
    expect(after?.currentStock).toBe((before?.currentStock ?? 0) - 3);
  });

  it("rejects an OUT adjustment larger than current stock at proposal time (never becomes a pending action)", async () => {
    const current = await InventoryItem.findOne({ organizationId: orgId, productId });
    const hugeQuantity = (current?.currentStock ?? 0) + 1000;

    const result = await callAdjustStock(context, { productId, direction: "OUT", quantity: hugeQuantity });
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/only .* in stock/i);
  });

  it("cancelling an adjustment leaves stock unchanged", async () => {
    const before = await InventoryItem.findOne({ organizationId: orgId, productId });
    const result = await callAdjustStock(context, { productId, direction: "IN", quantity: 7 });
    await cancelPendingAction(session, result.actionId!);

    const after = await InventoryItem.findOne({ organizationId: orgId, productId });
    expect(after?.currentStock).toBe(before?.currentStock);
  });

  it("denies proposing an adjustment for a role without inventory.adjust", async () => {
    const viewerContext: ToolContext = { ...context, role: "viewer" };
    const result = await callAdjustStock(viewerContext, { productId, direction: "IN", quantity: 1 });
    expect((result as { error?: string }).error).toBe("permission_denied");
  });
});
