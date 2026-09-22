import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { Membership } from "@/models/Membership";
import { AppError } from "@/lib/errors";
import type { SessionPayload } from "@/lib/auth/session";
import type { Role } from "@/models/roles";

export interface WorkspaceContext {
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string; slug: string };
  role: Role;
}

/**
 * Resolves the full workspace context (user + organization + role) for the
 * current session, re-verifying membership server-side rather than trusting
 * the JWT claims alone. Throws if the session no longer maps to real data.
 */
export async function getWorkspaceContext(
  session: SessionPayload,
): Promise<WorkspaceContext> {
  await connectToDatabase();

  const [user, organization, membership] = await Promise.all([
    User.findById(session.userId),
    Organization.findById(session.organizationId),
    Membership.findOne({ userId: session.userId, organizationId: session.organizationId }),
  ]);

  if (!user || !organization || !membership) {
    throw new AppError("UNAUTHORIZED", "Session is no longer valid.", 401);
  }

  return {
    user: { id: user._id.toString(), name: user.name, email: user.email },
    organization: {
      id: organization._id.toString(),
      name: organization.name,
      slug: organization.slug,
    },
    role: membership.role as Role,
  };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export async function listOrganizationMembers(organizationId: string): Promise<TeamMember[]> {
  await connectToDatabase();

  const memberships = await Membership.find({ organizationId })
    .sort({ createdAt: 1 })
    .populate<{ userId: { _id: string; name: string; email: string } }>("userId", "name email");

  return memberships
    .filter((m) => m.userId)
    .map((m) => ({
      id: String(m.userId._id),
      name: m.userId.name,
      email: m.userId.email,
      role: m.role as Role,
      joinedAt: m.createdAt.toISOString(),
    }));
}
