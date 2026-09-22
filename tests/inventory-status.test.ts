import { describe, it, expect } from "vitest";
import { deriveStockStatus } from "@/services/inventory.service";

describe("deriveStockStatus", () => {
  it("is OUT_OF_STOCK at zero", () => {
    expect(deriveStockStatus(0, 10)).toBe("OUT_OF_STOCK");
  });

  it("is OUT_OF_STOCK below zero (defensive)", () => {
    expect(deriveStockStatus(-1, 10)).toBe("OUT_OF_STOCK");
  });

  it("is LOW_STOCK when at or below the threshold but above zero", () => {
    expect(deriveStockStatus(10, 10)).toBe("LOW_STOCK");
    expect(deriveStockStatus(1, 10)).toBe("LOW_STOCK");
  });

  it("is IN_STOCK above the threshold", () => {
    expect(deriveStockStatus(11, 10)).toBe("IN_STOCK");
    expect(deriveStockStatus(1000, 10)).toBe("IN_STOCK");
  });

  it("treats a zero threshold as only-out-of-stock-at-zero", () => {
    expect(deriveStockStatus(0, 0)).toBe("OUT_OF_STOCK");
    expect(deriveStockStatus(1, 0)).toBe("IN_STOCK");
  });
});
