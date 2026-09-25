import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization, makeSession } from "../helpers/db";
import { updateModuleVisibility } from "@/services/workspace.service";
import { isModuleVisible } from "@/lib/auth/modules";
import { Organization } from "@/models/Organization";
import { buildTools } from "@/ai/tools";
import { moduleForApiPath } from "@/lib/auth/module-access";

describe("Module visibility", () => {
  let organizationId: string;
  let ownerId: string;

  beforeAll(async () => {
    await setupTestDb();
    const org = await createTestOrganization("Module Visibility Org");
    organizationId = org.organizationId;
    ownerId = org.userId;
  });

  it("defaults every module to visible for every role when unconfigured", async () => {
    const org = await Organization.findById(organizationId);
    expect(isModuleVisible(org?.settings.moduleVisibility, "viewer", "inventory")).toBe(true);
    expect(isModuleVisible(org?.settings.moduleVisibility, "staff", "knowledge")).toBe(true);
  });

  it("owner is always visible regardless of configuration", async () => {
    const session = makeSession(organizationId, ownerId, "owner");
    await updateModuleVisibility(session, { viewer: [] });
    const org = await Organization.findById(organizationId);
    expect(isModuleVisible(org?.settings.moduleVisibility, "owner", "inventory")).toBe(true);
  });

  it("lets an admin hide a module for a specific role", async () => {
    const session = makeSession(organizationId, ownerId, "owner");
    await updateModuleVisibility(session, {
      viewer: ["customers", "suppliers"],
      staff: ["inventory", "customers", "suppliers", "quotations", "knowledge"],
    });

    const org = await Organization.findById(organizationId);
    expect(isModuleVisible(org?.settings.moduleVisibility, "viewer", "inventory")).toBe(false);
    expect(isModuleVisible(org?.settings.moduleVisibility, "viewer", "customers")).toBe(true);
    expect(isModuleVisible(org?.settings.moduleVisibility, "staff", "inventory")).toBe(true);
  });

  it("rejects updates from a role below admin", async () => {
    const managerSession = makeSession(organizationId, ownerId, "manager");
    await expect(updateModuleVisibility(managerSession, { viewer: [] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("silently drops any attempt to restrict the owner role", async () => {
    const session = makeSession(organizationId, ownerId, "owner");
    const saved = await updateModuleVisibility(session, { owner: [], viewer: ["inventory"] });
    expect(saved.owner).toBeUndefined();
    expect(saved.viewer).toEqual(["inventory"]);
  });

  it("drops unknown module keys instead of persisting garbage", async () => {
    const session = makeSession(organizationId, ownerId, "owner");
    const saved = await updateModuleVisibility(session, {
      viewer: ["inventory", "not-a-real-module"],
    });
    expect(saved.viewer).toEqual(["inventory"]);
  });

  it("excludes AI tools for modules hidden from the role", () => {
    const base = { organizationId, userId: ownerId, conversationId: "c1" };
    const managerTools = buildTools({ ...base, role: "manager", moduleVisibility: { manager: ["inventory"] } });
    expect(managerTools.searchSuppliers).toBeUndefined();
    expect(managerTools.searchProducts).toBeDefined(); // products is not a gated module

    const ownerTools = buildTools({ ...base, role: "owner", moduleVisibility: { manager: ["inventory"] } });
    expect(ownerTools.searchSuppliers).toBeDefined();
  });

  it("maps gated API paths to their module", () => {
    expect(moduleForApiPath("/api/suppliers")).toBe("suppliers");
    expect(moduleForApiPath("/api/quotations/abc/convert")).toBe("quotations");
    expect(moduleForApiPath("/api/products")).toBeNull();
    expect(moduleForApiPath("/api/suppliersx")).toBeNull();
  });
});
