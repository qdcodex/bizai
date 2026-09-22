import { describe, it, expect } from "vitest";
import {
  computeLineTotal,
  computeQuotationTotals,
  assertMinSellingPrice,
  requiresApproval,
} from "@/services/quotation-calculations";
import { AppError } from "@/lib/errors";

describe("computeLineTotal", () => {
  it("multiplies quantity by unit price with no discount or tax", () => {
    const line = computeLineTotal({ quantity: 20, unitPrice: 1200 });
    expect(line.lineTotal).toBe(24000);
  });

  it("subtracts discount and adds tax", () => {
    const line = computeLineTotal({ quantity: 10, unitPrice: 500, discount: 200, tax: 90 });
    // 10*500 = 5000 - 200 + 90 = 4890
    expect(line.lineTotal).toBe(4890);
  });

  it("never returns a negative line total", () => {
    const line = computeLineTotal({ quantity: 1, unitPrice: 10, discount: 1000 });
    expect(line.lineTotal).toBe(0);
  });
});

describe("computeQuotationTotals", () => {
  it("matches the spec example: helmets + gloves with tax, no discount", () => {
    const totals = computeQuotationTotals([
      { quantity: 20, unitPrice: 1200, tax: 4320 }, // 24000 subtotal, 4320 tax
      { quantity: 10, unitPrice: 500, tax: 900 }, // 5000 subtotal, 900 tax
    ]);
    expect(totals.subtotal).toBe(29000);
    expect(totals.discount).toBe(0);
    expect(totals.tax).toBe(5220);
    expect(totals.total).toBe(34220);
  });

  it("sums discount and tax correctly across multiple lines", () => {
    const totals = computeQuotationTotals([
      { quantity: 2, unitPrice: 100, discount: 10, tax: 5 },
      { quantity: 3, unitPrice: 50, discount: 5, tax: 3 },
    ]);
    // subtotal = 200 + 150 = 350; discount = 15; tax = 8; total = 343
    expect(totals.subtotal).toBe(350);
    expect(totals.discount).toBe(15);
    expect(totals.tax).toBe(8);
    expect(totals.total).toBe(343);
  });

  it("returns zeroed totals for an empty line list", () => {
    const totals = computeQuotationTotals([]);
    expect(totals).toEqual({ subtotal: 0, discount: 0, tax: 0, total: 0 });
  });
});

describe("assertMinSellingPrice", () => {
  it("allows a price at or above the minimum", () => {
    expect(() =>
      assertMinSellingPrice({
        itemName: "Safety Helmet",
        unitPrice: 1200,
        minSellingPrice: 1000,
        overrideRequested: false,
        overrideAuthorized: false,
      }),
    ).not.toThrow();
  });

  it("rejects a price below the minimum without an override", () => {
    expect(() =>
      assertMinSellingPrice({
        itemName: "Safety Helmet",
        unitPrice: 900,
        minSellingPrice: 1000,
        overrideRequested: false,
        overrideAuthorized: false,
      }),
    ).toThrow(AppError);
  });

  it("rejects a below-minimum price even when override is requested but not authorized", () => {
    expect(() =>
      assertMinSellingPrice({
        itemName: "Safety Helmet",
        unitPrice: 900,
        minSellingPrice: 1000,
        overrideRequested: true,
        overrideAuthorized: false,
      }),
    ).toThrow(AppError);
  });

  it("allows a below-minimum price when override is both requested and authorized", () => {
    expect(() =>
      assertMinSellingPrice({
        itemName: "Safety Helmet",
        unitPrice: 900,
        minSellingPrice: 1000,
        overrideRequested: true,
        overrideAuthorized: true,
      }),
    ).not.toThrow();
  });

  it("throws an AppError with the BELOW_MIN_SELLING_PRICE code", () => {
    try {
      assertMinSellingPrice({
        itemName: "Widget",
        unitPrice: 5,
        minSellingPrice: 10,
        overrideRequested: false,
        overrideAuthorized: false,
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("BELOW_MIN_SELLING_PRICE");
    }
  });
});

describe("requiresApproval", () => {
  it("does not require approval when total is at or below the threshold", () => {
    expect(requiresApproval(1000, 1000)).toBe(false);
    expect(requiresApproval(500, 1000)).toBe(false);
  });

  it("requires approval when total exceeds the threshold", () => {
    expect(requiresApproval(1000.01, 1000)).toBe(true);
    expect(requiresApproval(5000, 1000)).toBe(true);
  });
});
