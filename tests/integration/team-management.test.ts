import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization, makeSession } from "../helpers/db";
import { createTeamMember, listOrganizationMembers } from "@/services/workspace.service";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";

describe("createTeamMember", () => {
  let organizationId: string;
  let ownerId: string;

  beforeAll(async () => {
    await setupTestDb();
    const org = await createTestOrganization("Team Mgmt Org");
    organizationId = org.organizationId;
    ownerId = org.userId;
  });

  it("lets an owner create a new user with any role at or below their own rank", async () => {
    const session = makeSession(organizationId, ownerId, "owner");
    const result = await createTeamMember(session, {
      name: "New Manager",
      email: `new-manager-${Date.now()}@test.local`,
      password: "Password123",
      role: "manager",
    });

    expect(result.role).toBe("manager");
    const members = await listOrganizationMembers(organizationId);
    expect(members.some((m) => m.id === result.id && m.role === "manager")).toBe(true);
  });

  it("logs the created user in with the assigned role and organization", async () => {
    const email = `new-staff-${Date.now()}@test.local`;
    const session = makeSession(organizationId, ownerId, "owner");
    const created = await createTeamMember(session, {
      name: "New Staff",
      email,
      password: "Password123",
      role: "staff",
    });

    const user = await User.findById(created.id);
    expect(user?.activeOrganizationId?.toString()).toBe(organizationId);
    const membership = await Membership.findOne({ userId: created.id, organizationId });
    expect(membership?.role).toBe("staff");
  });

  it("rejects creation from a role below admin", async () => {
    const managerSession = makeSession(organizationId, ownerId, "manager");
    await expect(
      createTeamMember(managerSession, {
        name: "Should Fail",
        email: `should-fail-${Date.now()}@test.local`,
        password: "Password123",
        role: "viewer",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects assigning a role higher than the creator's own rank", async () => {
    const adminSession = makeSession(organizationId, ownerId, "admin");
    await expect(
      createTeamMember(adminSession, {
        name: "Should Fail",
        email: `should-fail-owner-${Date.now()}@test.local`,
        password: "Password123",
        role: "owner",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an admin to create another admin (equal rank)", async () => {
    const adminSession = makeSession(organizationId, ownerId, "admin");
    const result = await createTeamMember(adminSession, {
      name: "Peer Admin",
      email: `peer-admin-${Date.now()}@test.local`,
      password: "Password123",
      role: "admin",
    });
    expect(result.role).toBe("admin");
  });

  it("rejects a duplicate email", async () => {
    const email = `dup-${Date.now()}@test.local`;
    const session = makeSession(organizationId, ownerId, "owner");
    await createTeamMember(session, { name: "First", email, password: "Password123", role: "viewer" });

    await expect(
      createTeamMember(session, { name: "Second", email, password: "Password123", role: "viewer" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
