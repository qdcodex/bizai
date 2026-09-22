import { describe, it, expect } from "vitest";
import { can } from "@/lib/auth/permissions";

describe("Role permission matrix", () => {
  it("viewer can read but not write anything", () => {
    expect(can("viewer", "products.read")).toBe(true);
    expect(can("viewer", "products.create")).toBe(false);
    expect(can("viewer", "quotations.create")).toBe(false);
    expect(can("viewer", "inventory.adjust")).toBe(false);
  });

  it("staff can create quotations and adjust inventory, but not manage catalog data", () => {
    expect(can("staff", "quotations.create")).toBe(true);
    expect(can("staff", "inventory.adjust")).toBe(true);
    expect(can("staff", "products.create")).toBe(false);
    expect(can("staff", "customers.create")).toBe(false);
  });

  it("manager can manage catalog data but not approve quotations", () => {
    expect(can("manager", "products.create")).toBe(true);
    expect(can("manager", "customers.create")).toBe(true);
    expect(can("manager", "suppliers.create")).toBe(true);
    expect(can("manager", "quotations.delete")).toBe(true);
    expect(can("manager", "quotations.approve")).toBe(false);
  });

  it("admin can approve quotations", () => {
    expect(can("admin", "quotations.approve")).toBe(true);
  });

  it("owner has every permission an admin has", () => {
    expect(can("owner", "quotations.approve")).toBe(true);
    expect(can("owner", "products.delete")).toBe(true);
  });
});
