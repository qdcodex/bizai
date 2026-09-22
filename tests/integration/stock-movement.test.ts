import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization } from "../helpers/db";
import { createProduct } from "@/services/product.service";
import { recordStockMovement } from "@/services/stock-movement.service";
import { getInventoryDetail, deriveStockStatus } from "@/services/inventory.service";
import { AppError } from "@/lib/errors";

async function makeProduct(organizationId: string, overrides: Partial<Parameters<typeof createProduct>[1]> = {}) {
  return createProduct(organizationId, {
    itemCode: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemName: "Test Widget",
    description: "",
    category: "Test",
    brand: "",
    partNumber: "",
    uom: "unit",
    costPrice: 10,
    sellingPrice: 20,
    minSellingPrice: 15,
    lowStockThreshold: 5,
    imageUrl: "",
    isActive: true,
    ...overrides,
  });
}

describe("Stock movements", () => {
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const org = await createTestOrganization("Stock Movement Test Org");
    organizationId = org.organizationId;
    userId = org.userId;
  });

  it("increases stock on a PURCHASE movement", async () => {
    const product = await makeProduct(organizationId);

    const result = await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "PURCHASE",
      quantity: 50,
      createdBy: userId,
    });

    expect(result.previousStock).toBe(0);
    expect(result.newStock).toBe(50);

    const detail = await getInventoryDetail(organizationId, product._id.toString());
    expect(detail.currentStock).toBe(50);
  });

  it("decreases stock on a SALE movement", async () => {
    const product = await makeProduct(organizationId);
    await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "PURCHASE",
      quantity: 20,
      createdBy: userId,
    });

    const result = await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "SALE",
      quantity: 8,
      createdBy: userId,
    });

    expect(result.previousStock).toBe(20);
    expect(result.newStock).toBe(12);
  });

  it("rejects a movement that would take stock negative", async () => {
    const product = await makeProduct(organizationId);
    await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "PURCHASE",
      quantity: 5,
      createdBy: userId,
    });

    await expect(
      recordStockMovement({
        organizationId,
        productId: product._id.toString(),
        type: "SALE",
        quantity: 6,
        createdBy: userId,
      }),
    ).rejects.toThrow(AppError);

    // Stock must be unchanged after the rejected operation.
    const detail = await getInventoryDetail(organizationId, product._id.toString());
    expect(detail.currentStock).toBe(5);
  });

  it("computes LOW_STOCK and OUT_OF_STOCK from real stock after movements", async () => {
    const product = await makeProduct(organizationId, { lowStockThreshold: 10 });

    await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "PURCHASE",
      quantity: 10,
      createdBy: userId,
    });
    let detail = await getInventoryDetail(organizationId, product._id.toString());
    expect(detail.stockStatus).toBe("LOW_STOCK");

    await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "SALE",
      quantity: 10,
      createdBy: userId,
    });
    detail = await getInventoryDetail(organizationId, product._id.toString());
    expect(detail.stockStatus).toBe("OUT_OF_STOCK");
    expect(deriveStockStatus(detail.currentStock, product.lowStockThreshold)).toBe("OUT_OF_STOCK");
  });

  it("does not oversell under concurrent decrement attempts on the same product", async () => {
    const product = await makeProduct(organizationId);
    await recordStockMovement({
      organizationId,
      productId: product._id.toString(),
      type: "PURCHASE",
      quantity: 10,
      createdBy: userId,
    });

    // Fire 5 concurrent "sell 3" operations against only 10 units of stock.
    // At most 3 can succeed (9 units); the rest must fail with INSUFFICIENT_STOCK.
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        recordStockMovement({
          organizationId,
          productId: product._id.toString(),
          type: "SALE",
          quantity: 3,
          createdBy: userId,
        }),
      ),
    );

    const succeeded = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected");

    expect(succeeded.length).toBe(3);
    expect(failed.length).toBe(2);

    const detail = await getInventoryDetail(organizationId, product._id.toString());
    expect(detail.currentStock).toBe(1);
  });
});
