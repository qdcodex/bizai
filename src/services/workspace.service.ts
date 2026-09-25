import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { Membership } from "@/models/Membership";
import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/password";
import { roleAtLeast, ROLE_RANK, type Role } from "@/models/roles";
import { GATED_MODULES, CONFIGURABLE_ROLES, type ModuleVisibility } from "@/lib/auth/modules";
import type { SessionPayload } from "@/lib/auth/session";
import type { CreateTeamMemberFormValues } from "@/lib/validation/auth";

export interface WorkspaceContext {
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string; slug: string; moduleVisibility: ModuleVisibility };
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
      moduleVisibility: organization.settings.moduleVisibility ?? {},
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

/**
 * Creates a brand-new user account and adds it directly to the current
 * organization with the given role — no invite-email flow exists yet, so
 * the admin sets an initial password the new teammate can log in with
 * immediately. Only admin+ may call this, and only with a role at or below
 * their own rank (an admin can't create another owner, for example).
 */
export async function createTeamMember(
  session: SessionPayload,
  input: CreateTeamMemberFormValues,
): Promise<TeamMember> {
  if (!roleAtLeast(session.role, "admin")) {
    throw new AppError("FORBIDDEN", "You do not have permission to add team members.", 403);
  }
  if (ROLE_RANK[input.role] > ROLE_RANK[session.role]) {
    throw new AppError("FORBIDDEN", "You cannot assign a role higher than your own.", 403);
  }

  await connectToDatabase();

  const email = input.email.toLowerCase().trim();
  const existing = await User.exists({ email });
  if (existing) {
    throw new AppError("CONFLICT", "An account with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash,
    activeOrganizationId: session.organizationId,
  });

  const membership = await Membership.create({
    userId: user._id,
    organizationId: session.organizationId,
    role: input.role,
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: input.role,
    joinedAt: membership.createdAt.toISOString(),
  };
}

const MODULE_KEY_SET = new Set<string>(GATED_MODULES.map((m) => m.key));
const CONFIGURABLE_ROLE_SET = new Set<string>(CONFIGURABLE_ROLES);

/**
 * Saves which of the gated modules each configurable role (admin, manager,
 * staff, viewer — never owner) can see and use. This is the single write
 * path for Settings -> Module Access; requirePagePermission reads the same
 * setting to actually enforce it on every gated page, not just the sidebar.
 */
export async function updateModuleVisibility(
  session: SessionPayload,
  moduleVisibility: ModuleVisibility,
): Promise<ModuleVisibility> {
  if (!roleAtLeast(session.role, "admin")) {
    throw new AppError("FORBIDDEN", "You do not have permission to change module access.", 403);
  }

  const sanitized: ModuleVisibility = {};
  for (const [role, modules] of Object.entries(moduleVisibility)) {
    if (!CONFIGURABLE_ROLE_SET.has(role) || !Array.isArray(modules)) continue;
    sanitized[role as Role] = modules.filter((key) => MODULE_KEY_SET.has(key));
  }

  await connectToDatabase();
  const organization = await Organization.findByIdAndUpdate(
    session.organizationId,
    { $set: { "settings.moduleVisibility": sanitized } },
    { new: true },
  );
  if (!organization) {
    throw new AppError("NOT_FOUND", "Organization not found.", 404);
  }

  return organization.settings.moduleVisibility ?? {};
}
