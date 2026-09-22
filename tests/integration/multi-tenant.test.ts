import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization } from "../helpers/db";
import { createProduct, getProduct } from "@/services/product.service";
import { createCustomer, getCustomer } from "@/services/customer.service";
import { AppError } from "@/lib/errors";

describe("Multi-tenant isolation", () => {
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    await setupTestDb();
    orgAId = (await createTestOrganization("Tenant A")).organizationId;
    orgBId = (await createTestOrganization("Tenant B")).organizationId;
  });

  it("cannot read Organization B's product using Organization A's id", async () => {
    const productB = await createProduct(orgBId, {
      itemCode: "TENANT-B-001",
      itemName: "Org B Widget",
      description: "",
      category: "",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: 10,
      sellingPrice: 20,
      minSellingPrice: 15,
      lowStockThreshold: 5,
      imageUrl: "",
      isActive: true,
    });

    await expect(getProduct(orgAId, productB._id.toString())).rejects.toThrow(AppError);
    await expect(getProduct(orgAId, productB._id.toString())).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });

    // The rightful owner can still read it.
    const found = await getProduct(orgBId, productB._id.toString());
    expect(found.itemName).toBe("Org B Widget");
  });

  it("cannot read Organization B's customer using Organization A's id", async () => {
    const customerB = await createCustomer(orgBId, {
      customerCode: "TENANT-B-CUST-1",
      name: "Org B Customer",
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

    await expect(getCustomer(orgAId, customerB._id.toString())).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
    });
  });

  it("identical item codes in two different organizations do not conflict", async () => {
    // The unique index is (organizationId, itemCode), not itemCode alone.
    await expect(
      createProduct(orgAId, {
        itemCode: "SHARED-CODE",
        itemName: "Org A Widget",
        description: "",
        category: "",
        brand: "",
        partNumber: "",
        uom: "unit",
        costPrice: 10,
        sellingPrice: 20,
        minSellingPrice: 15,
        lowStockThreshold: 5,
        imageUrl: "",
        isActive: true,
      }),
    ).resolves.toBeDefined();

    await expect(
      createProduct(orgBId, {
        itemCode: "SHARED-CODE",
        itemName: "Org B Widget",
        description: "",
        category: "",
        brand: "",
        partNumber: "",
        uom: "unit",
        costPrice: 10,
        sellingPrice: 20,
        minSellingPrice: 15,
        lowStockThreshold: 5,
        imageUrl: "",
        isActive: true,
      }),
    ).resolves.toBeDefined();
  });
});
