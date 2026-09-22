import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization, makeSession } from "../helpers/db";
import { createProduct } from "@/services/product.service";
import { createCustomer } from "@/services/customer.service";
import {
  createQuotation,
  submitQuotation,
  approveQuotation,
  rejectQuotation,
  convertQuotation,
} from "@/services/quotation.service";
import { getInventoryDetail } from "@/services/inventory.service";
import { recordStockMovement } from "@/services/stock-movement.service";
import { Organization } from "@/models/Organization";
import { AppError } from "@/lib/errors";

describe("Quotation workflow", () => {
  let organizationId: string;
  let userId: string;
  let customerId: string;

  beforeAll(async () => {
    await setupTestDb();
    const org = await createTestOrganization("Quotation Workflow Org");
    organizationId = org.organizationId;
    userId = org.userId;

    const customer = await createCustomer(organizationId, {
      customerCode: "QCUST-1",
      name: "ABC Industries",
      companyName: "ABC Industries Pvt Ltd",
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

  async function makeProduct(sellingPrice: number, minSellingPrice: number) {
    const product = await createProduct(organizationId, {
      itemCode: `QW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemName: "Safety Helmet",
      description: "",
      category: "",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: sellingPrice * 0.6,
      sellingPrice,
      minSellingPrice,
      lowStockThreshold: 5,
      imageUrl: "",
      isActive: true,
    });
    await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "PURCHASE",
      quantity: 100,
      createdBy: userId,
    });
    return product;
  }

  it("generates sequential, uniquely formatted quotation numbers", async () => {
    const product = await makeProduct(1200, 1000);
    const session = makeSession(organizationId, userId);

    const q1 = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });
    const q2 = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });

    const year = new Date().getFullYear();
    expect(q1.quotationNumber).toMatch(new RegExp(`^QT-${year}-\\d{6}$`));
    expect(q2.quotationNumber).not.toBe(q1.quotationNumber);

    const [, seq1] = q1.quotationNumber.split(`QT-${year}-`);
    const [, seq2] = q2.quotationNumber.split(`QT-${year}-`);
    expect(Number(seq2)).toBe(Number(seq1) + 1);
  });

  it("rejects a unit price below the product's minimum selling price", async () => {
    const product = await makeProduct(1000, 1000);
    const session = makeSession(organizationId, userId);

    await expect(
      createQuotation(session, {
        customerId,
        items: [{ productId: product._id.toString(), quantity: 1, unitPrice: 900 }],
        notes: "",
        overrideMinPrice: false,
      }),
    ).rejects.toMatchObject({ code: "BELOW_MIN_SELLING_PRICE" });
  });

  it("auto-approves a submitted quotation under the approval threshold", async () => {
    const product = await makeProduct(500, 400);
    const session = makeSession(organizationId, userId);

    const quotation = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });
    expect(quotation.total).toBeLessThanOrEqual(1000);

    const submitted = await submitQuotation(session, quotation._id.toString());
    expect(submitted.status).toBe("APPROVED");
  });

  it("requires approval for a submitted quotation over the threshold", async () => {
    const product = await makeProduct(2000, 1500);
    const session = makeSession(organizationId, userId);

    const quotation = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });
    expect(quotation.total).toBeGreaterThan(1000);

    const submitted = await submitQuotation(session, quotation._id.toString());
    expect(submitted.status).toBe("PENDING_APPROVAL");

    const approved = await approveQuotation(session, quotation._id.toString());
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedBy?.toString()).toBe(userId);
  });

  it("respects a custom organization approval threshold", async () => {
    await Organization.findByIdAndUpdate(organizationId, {
      "settings.quotationApprovalThreshold": 50,
    });

    const product = await makeProduct(100, 80);
    const session = makeSession(organizationId, userId);

    const quotation = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });
    const submitted = await submitQuotation(session, quotation._id.toString());
    expect(submitted.status).toBe("PENDING_APPROVAL");

    await Organization.findByIdAndUpdate(organizationId, {
      "settings.quotationApprovalThreshold": 1000,
    });
  });

  it("rejects a pending quotation and prevents further transitions", async () => {
    const product = await makeProduct(2000, 1500);
    const session = makeSession(organizationId, userId);

    const quotation = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });
    await submitQuotation(session, quotation._id.toString());
    const rejected = await rejectQuotation(session, quotation._id.toString(), "Too expensive");
    expect(rejected.status).toBe("REJECTED");

    await expect(approveQuotation(session, quotation._id.toString())).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  it("converting a quotation deducts real stock atomically", async () => {
    const product = await makeProduct(500, 400);
    const session = makeSession(organizationId, userId);

    const before = await getInventoryDetail(organizationId, product._id.toString());

    const quotation = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 3 }],
      notes: "",
      overrideMinPrice: false,
    });
    const submitted = await submitQuotation(session, quotation._id.toString());
    if (submitted.status === "PENDING_APPROVAL") {
      await approveQuotation(session, quotation._id.toString());
    }
    const converted = await convertQuotation(session, quotation._id.toString());
    expect(converted.status).toBe("CONVERTED");

    const after = await getInventoryDetail(organizationId, product._id.toString());
    expect(after.currentStock).toBe(before.currentStock - 3);
  });

  it("does not allow converting a quotation that is not approved", async () => {
    const product = await makeProduct(2000, 1500);
    const session = makeSession(organizationId, userId);

    const quotation = await createQuotation(session, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });

    await expect(convertQuotation(session, quotation._id.toString())).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  it("staff role cannot approve quotations", async () => {
    const product = await makeProduct(2000, 1500);
    const staffSession = makeSession(organizationId, userId, "staff");

    const quotation = await createQuotation(staffSession, {
      customerId,
      items: [{ productId: product._id.toString(), quantity: 1 }],
      notes: "",
      overrideMinPrice: false,
    });
    await submitQuotation(staffSession, quotation._id.toString());

    await expect(approveQuotation(staffSession, quotation._id.toString())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws an AppError instance for downstream error handling", async () => {
    try {
      await createQuotation(makeSession(organizationId, userId), {
        customerId: "000000000000000000000000",
        items: [{ productId: "000000000000000000000000", quantity: 1 }],
        notes: "",
        overrideMinPrice: false,
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
    }
  });
});
