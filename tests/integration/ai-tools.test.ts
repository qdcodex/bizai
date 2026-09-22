import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization } from "../helpers/db";
import { createProduct } from "@/services/product.service";
import { createCustomer } from "@/services/customer.service";
import { createSupplier } from "@/services/supplier.service";
import { createQuotation, submitQuotation } from "@/services/quotation.service";
import { recordStockMovement } from "@/services/stock-movement.service";
import { createProductTools } from "@/ai/tools/product-tools";
import { createInventoryTools } from "@/ai/tools/inventory-tools";
import { createCustomerTools } from "@/ai/tools/customer-tools";
import { createSupplierTools } from "@/ai/tools/supplier-tools";
import { createQuotationTools } from "@/ai/tools/quotation-tools";
import { buildTools } from "@/ai/tools";
import type { ToolContext } from "@/ai/types";

// Tests only exercise the business logic inside `execute`, not the AI SDK's
// own tool-call plumbing (toolCallId, messages, abortSignal, ...), so the
// execution options are stubbed out and the tool is called loosely-typed.
async function callTool<T>(tool: unknown, input: unknown): Promise<T> {
  const execute = (tool as { execute?: (input: unknown, options: unknown) => Promise<T> }).execute;
  if (!execute) throw new Error("Tool has no execute function");
  return execute(input, {});
}

describe("AI tools", () => {
  let contextA: ToolContext;
  let contextB: ToolContext;
  let helmetProductId: string;
  let customerId: string;

  beforeAll(async () => {
    await setupTestDb();
    const orgA = await createTestOrganization("AI Tools Org A");
    const orgB = await createTestOrganization("AI Tools Org B");
    contextA = {
      organizationId: orgA.organizationId,
      userId: orgA.userId,
      role: "owner",
      conversationId: "000000000000000000000001",
    };
    contextB = {
      organizationId: orgB.organizationId,
      userId: orgB.userId,
      role: "owner",
      conversationId: "000000000000000000000002",
    };

    const helmet = await createProduct(contextA.organizationId, {
      itemCode: "AI-HELMET-1",
      itemName: "Safety Helmet",
      description: "",
      category: "Safety Equipment",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: 800,
      sellingPrice: 1200,
      minSellingPrice: 1000,
      lowStockThreshold: 10,
      imageUrl: "",
      isActive: true,
    });
    helmetProductId = helmet._id.toString();
    await recordStockMovement({
      organizationId: contextA.organizationId,
      productId: helmetProductId,
      type: "PURCHASE",
      quantity: 42,
      createdBy: contextA.userId,
    });

    await createProduct(contextA.organizationId, {
      itemCode: "AI-LOWSTOCK-1",
      itemName: "Low Stock Widget",
      description: "",
      category: "",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: 10,
      sellingPrice: 20,
      minSellingPrice: 15,
      lowStockThreshold: 20,
      imageUrl: "",
      isActive: true,
    });

    const customer = await createCustomer(contextA.organizationId, {
      customerCode: "AI-CUST-1",
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

    await createSupplier(contextA.organizationId, {
      supplierCode: "AI-SUP-1",
      name: "Voltage Electricals",
      companyName: "Voltage Electricals Co",
      email: "",
      phone: "",
      taxNumber: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      paymentTerms: "Net 30",
      isActive: true,
    });

    const quotation = await createQuotation(
      { organizationId: contextA.organizationId, userId: contextA.userId, role: "owner" },
      { customerId, items: [{ productId: helmetProductId, quantity: 1 }], notes: "", overrideMinPrice: false },
    );
    await submitQuotation(
      { organizationId: contextA.organizationId, userId: contextA.userId, role: "owner" },
      quotation._id.toString(),
    );
  });

  describe("product tools", () => {
    it("searchProducts finds a product by name", async () => {
      const tools = createProductTools(contextA);
      const result = await callTool<{ count: number; products: Array<{ itemName: string }> }>(
        tools.searchProducts,
        { query: "Safety Helmet" },
      );
      expect(result.count).toBeGreaterThan(0);
      expect(result.products.some((p) => p.itemName === "Safety Helmet")).toBe(true);
    });

    it("getProduct returns full details by id", async () => {
      const tools = createProductTools(contextA);
      const result = await callTool<{ found: boolean; product?: { itemName: string } }>(tools.getProduct, {
        productId: helmetProductId,
      });
      expect(result.found).toBe(true);
      expect(result.product?.itemName).toBe("Safety Helmet");
    });

    it("getProduct does not leak another organization's product", async () => {
      const tools = createProductTools(contextB);
      const result = await callTool<{ found: boolean }>(tools.getProduct, { productId: helmetProductId });
      expect(result.found).toBe(false);
    });
  });

  describe("inventory tools", () => {
    it("getLowStockProducts lists products below their threshold", async () => {
      const tools = createInventoryTools(contextA);
      const result = await callTool<{ products: Array<{ itemName: string }> }>(tools.getLowStockProducts, {
        limit: 50,
      });
      expect(result.products.some((p) => p.itemName === "Low Stock Widget")).toBe(true);
    });

    it("checkStockAvailability reflects real stock", async () => {
      const tools = createInventoryTools(contextA);
      const result = await callTool<{ available: boolean; currentStock: number }>(tools.checkStockAvailability, {
        productId: helmetProductId,
        quantity: 10,
      });
      expect(result.currentStock).toBe(42);
      expect(result.available).toBe(true);
    });

    it("getProductStock answers 'how many Safety Helmets do we have' from the database", async () => {
      const tools = createInventoryTools(contextA);
      const result = await callTool<{ status: string; product?: { currentStock: number } }>(tools.getProductStock, {
        query: "Safety Helmet",
      });
      expect(result.status).toBe("found");
      expect(result.product?.currentStock).toBe(42);
    });

    it("getStockMovements lists real movement history", async () => {
      const tools = createInventoryTools(contextA);
      const result = await callTool<{ movements: Array<{ type: string }> }>(tools.getStockMovements, {
        productQuery: "Safety Helmet",
        limit: 10,
      });
      expect(result.movements.some((m) => m.type === "PURCHASE")).toBe(true);
    });
  });

  describe("customer tools", () => {
    it("searchCustomers finds 'ABC Industries'", async () => {
      const tools = createCustomerTools(contextA);
      const result = await callTool<{ customers: Array<{ name: string }> }>(tools.searchCustomers, {
        query: "ABC Industries",
      });
      expect(result.customers.some((c) => c.name === "ABC Industries")).toBe(true);
    });

    it("getCustomer returns full details by id", async () => {
      const tools = createCustomerTools(contextA);
      const result = await callTool<{ found: boolean; customer?: { name: string } }>(tools.getCustomer, {
        customerId,
      });
      expect(result.found).toBe(true);
      expect(result.customer?.name).toBe("ABC Industries");
    });
  });

  describe("supplier tools", () => {
    it("searchSuppliers finds a supplier by name", async () => {
      const tools = createSupplierTools(contextA);
      const result = await callTool<{ suppliers: Array<{ name: string }> }>(tools.searchSuppliers, {
        query: "Voltage",
      });
      expect(result.suppliers.some((s) => s.name === "Voltage Electricals")).toBe(true);
    });
  });

  describe("quotation tools", () => {
    it("searchQuotations finds pending quotations", async () => {
      const tools = createQuotationTools(contextA);
      const result = await callTool<{ quotations: Array<{ status: string }> }>(tools.searchQuotations, {
        status: "PENDING_APPROVAL",
        limit: 10,
      });
      expect(result.quotations.length).toBeGreaterThan(0);
      expect(result.quotations.every((q) => q.status === "PENDING_APPROVAL")).toBe(true);
    });

    it("getQuotation resolves a quotation by number", async () => {
      const tools = createQuotationTools(contextA);
      const search = await callTool<{ quotations: Array<{ quotationNumber: string }> }>(tools.searchQuotations, {
        limit: 1,
      });
      const number = search.quotations[0].quotationNumber;

      const result = await callTool<{ status: string; quotation?: { quotationNumber: string } }>(tools.getQuotation, {
        quotationNumber: number,
      });
      expect(result.status).toBe("found");
      expect(result.quotation?.quotationNumber).toBe(number);
    });
  });

  describe("security", () => {
    it("does not expose createQuotation to a viewer role", () => {
      const tools = buildTools({ ...contextA, role: "viewer" });
      expect(tools.createQuotation).toBeUndefined();
      expect(tools.searchProducts).toBeDefined();
    });

    it("exposes createQuotation to a staff role (quotations.create)", () => {
      const tools = buildTools({ ...contextA, role: "staff" });
      expect(tools.createQuotation).toBeDefined();
    });

    it("does not expose products.create-only actions since no such AI tool exists, but read tools remain available to viewer", () => {
      const tools = buildTools({ ...contextA, role: "viewer" });
      expect(tools.getLowStockProducts).toBeDefined();
      expect(tools.searchCustomers).toBeDefined();
    });
  });
});
