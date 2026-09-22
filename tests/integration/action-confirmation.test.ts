import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization } from "../helpers/db";
import { createProduct } from "@/services/product.service";
import { createCustomer } from "@/services/customer.service";
import { createQuotationTools } from "@/ai/tools/quotation-tools";
import { confirmPendingAction, cancelPendingAction, getPendingActionView } from "@/ai/actions/action-manager";
import { PendingAction } from "@/models/PendingAction";
import { AIActionAudit } from "@/models/AIActionAudit";
import { Quotation } from "@/models/Quotation";
import { AppError } from "@/lib/errors";
import type { ToolContext } from "@/ai/types";
import type { SessionPayload } from "@/lib/auth/session";

async function callCreateQuotation(context: ToolContext, input: unknown) {
  const tools = createQuotationTools(context);
  const execute = tools.createQuotation.execute as (input: unknown, options: unknown) => Promise<{
    status: string;
    actionId?: string;
    preview?: unknown;
    message?: string;
  }>;
  return execute(input, {});
}

describe("Action confirmation lifecycle", () => {
  let orgAId: string;
  let orgBId: string;
  let contextA: ToolContext;
  let sessionA: SessionPayload;
  let productId: string;
  let customerId: string;

  beforeAll(async () => {
    await setupTestDb();
    const orgA = await createTestOrganization("Action Confirmation Org A");
    const orgB = await createTestOrganization("Action Confirmation Org B");
    orgAId = orgA.organizationId;
    orgBId = orgB.organizationId;

    contextA = {
      organizationId: orgAId,
      userId: orgA.userId,
      role: "owner",
      conversationId: "000000000000000000000010",
    };
    sessionA = { organizationId: orgAId, userId: orgA.userId, role: "owner" };

    const product = await createProduct(orgAId, {
      itemCode: "ACT-CONF-1",
      itemName: "Confirmable Widget",
      description: "",
      category: "",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: 100,
      sellingPrice: 200,
      minSellingPrice: 150,
      lowStockThreshold: 5,
      imageUrl: "",
      isActive: true,
    });
    productId = product._id.toString();

    const customer = await createCustomer(orgAId, {
      customerCode: "ACT-CONF-CUST-1",
      name: "Confirmable Customer",
      companyName: "",
      email: "",
      phone: "",
      taxNumber: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      creditLimit: 0,
      paymentTerms: "Net 30",
      isActive: true,
    });
    customerId = customer._id.toString();
  });

  it("createQuotation's tool call never writes a Quotation — it only creates a pending action + preview", async () => {
    const before = await Quotation.countDocuments({ organizationId: orgAId });
    const result = await callCreateQuotation(contextA, {
      customerId,
      items: [{ productId, quantity: 2 }],
    });
    expect(result.status).toBe("pending_confirmation");
    expect(result.actionId).toBeDefined();

    const after = await Quotation.countDocuments({ organizationId: orgAId });
    expect(after).toBe(before);

    const pending = await PendingAction.findById(result.actionId);
    expect(pending?.status).toBe("PENDING_CONFIRMATION");
    expect(pending?.actionType).toBe("CREATE_QUOTATION");
  });

  it("confirms a pending action exactly once, creating exactly one Quotation", async () => {
    const before = await Quotation.countDocuments({ organizationId: orgAId });
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    const confirmResult = await confirmPendingAction(sessionA, actionId);
    expect(confirmResult.status).toBe("COMPLETED");
    expect(confirmResult.data?.quotationId).toBeDefined();

    const after = await Quotation.countDocuments({ organizationId: orgAId });
    expect(after).toBe(before + 1);

    const audit = await AIActionAudit.findOne({ actionId });
    expect(audit?.status).toBe("COMPLETED");
  });

  it("is idempotent: confirming the same action twice does not create a second Quotation", async () => {
    const before = await Quotation.countDocuments({ organizationId: orgAId });
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    const first = await confirmPendingAction(sessionA, actionId);
    const second = await confirmPendingAction(sessionA, actionId);

    expect(first.status).toBe("COMPLETED");
    expect(second.status).toBe("COMPLETED");
    expect(second.data?.quotationId).toBe(first.data?.quotationId);

    const after = await Quotation.countDocuments({ organizationId: orgAId });
    expect(after).toBe(before + 1);
  });

  it("handles concurrent confirmation attempts safely: exactly one Quotation is created", async () => {
    const before = await Quotation.countDocuments({ organizationId: orgAId });
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    const [a, b] = await Promise.allSettled([
      confirmPendingAction(sessionA, actionId),
      confirmPendingAction(sessionA, actionId),
    ]);

    // At least one must succeed; the other either idempotently reports the
    // same completion or safely reports "already being processed" — either
    // way, no second write occurs.
    const succeeded = [a, b].filter((r) => r.status === "fulfilled");
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    const after = await Quotation.countDocuments({ organizationId: orgAId });
    expect(after).toBe(before + 1);
  });

  it("cancels a pending action without creating a Quotation", async () => {
    const before = await Quotation.countDocuments({ organizationId: orgAId });
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    const cancelled = await cancelPendingAction(sessionA, actionId);
    expect(cancelled.status).toBe("CANCELLED");

    await expect(confirmPendingAction(sessionA, actionId)).rejects.toMatchObject({ code: "ACTION_NOT_PENDING" });

    const after = await Quotation.countDocuments({ organizationId: orgAId });
    expect(after).toBe(before);
  });

  it("never executes an expired action", async () => {
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    await PendingAction.findByIdAndUpdate(actionId, { expiresAt: new Date(Date.now() - 60_000) });

    await expect(confirmPendingAction(sessionA, actionId)).rejects.toMatchObject({ code: "ACTION_EXPIRED" });

    const view = await getPendingActionView(sessionA, actionId);
    expect(view.status).toBe("EXPIRED");
    expect((await PendingAction.findById(actionId))?.status).toBe("EXPIRED");
  });

  it("rejects confirming an action that belongs to a different organization", async () => {
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    const sessionB: SessionPayload = { organizationId: orgBId, userId: "000000000000000000000099", role: "owner" };
    await expect(confirmPendingAction(sessionB, actionId)).rejects.toMatchObject({ code: "ACTION_NOT_FOUND" });
    await expect(getPendingActionView(sessionB, actionId)).rejects.toMatchObject({ code: "ACTION_NOT_FOUND" });
  });

  it("re-checks permission at confirm time, not just at proposal time", async () => {
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    const viewerSession: SessionPayload = { organizationId: orgAId, userId: sessionA.userId, role: "viewer" };
    await expect(confirmPendingAction(viewerSession, actionId)).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Still pending — a denied confirm attempt must not consume the action.
    const view = await getPendingActionView(sessionA, actionId);
    expect(view.status).toBe("PENDING_CONFIRMATION");
  });

  it("propagates a real validation failure (e.g. product no longer active) as FAILED, not a thrown error", async () => {
    const result = await callCreateQuotation(contextA, { customerId, items: [{ productId, quantity: 1 }] });
    const actionId = result.actionId!;

    // Simulate the world changing between preview and confirm.
    const { Product } = await import("@/models/Product");
    await Product.findByIdAndUpdate(productId, { isActive: false });

    const confirmResult = await confirmPendingAction(sessionA, actionId);
    expect(confirmResult.status).toBe("FAILED");

    await Product.findByIdAndUpdate(productId, { isActive: true });
  });

  it("throws a not-found AppError for a malformed action id", async () => {
    await expect(getPendingActionView(sessionA, "not-a-valid-id")).rejects.toBeInstanceOf(AppError);
  });
});
