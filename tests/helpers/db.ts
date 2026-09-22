import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";
import type { Role } from "@/models/roles";

/**
 * Each test creates its own uniquely-named organization (see
 * createTestOrganization), so test files never need to share or reset
 * database state between each other — just connect once per file.
 */
export async function setupTestDb() {
  await connectToDatabase();
}

export async function createTestOrganization(name: string) {
  const user = await User.create({
    name: `${name} Owner`,
    email: `${name.toLowerCase().replace(/\s+/g, "-")}-${new Types.ObjectId().toString()}@test.local`,
    passwordHash: "not-a-real-hash",
  });

  const organization = await Organization.create({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${new Types.ObjectId().toString()}`,
    ownerId: user._id,
  });

  user.activeOrganizationId = organization._id;
  await user.save();

  await Membership.create({ userId: user._id, organizationId: organization._id, role: "owner" });

  return {
    userId: user._id.toString(),
    organizationId: organization._id.toString(),
  };
}

export function makeSession(organizationId: string, userId: string, role: Role = "owner") {
  return { organizationId, userId, role };
}
