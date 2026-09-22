import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Organization } from "@/models/Organization";
import { Membership } from "@/models/Membership";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import type { Role } from "@/models/roles";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface AuthResult {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "organization";
  let candidate = root;
  let attempt = 0;
  while (await Organization.exists({ slug: candidate })) {
    attempt += 1;
    candidate = `${root}-${attempt}`;
  }
  return candidate;
}

export async function registerOrganizationAndOwner(
  input: RegisterInput,
): Promise<AuthResult> {
  await connectToDatabase();

  const email = input.email.toLowerCase().trim();
  const existing = await User.exists({ email });
  if (existing) {
    throw new AppError("CONFLICT", "An account with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.organizationName);

  const dbSession = await mongoose.startSession();
  try {
    let result: AuthResult | undefined;
    await dbSession.withTransaction(async () => {
      const [user] = await User.create(
        [{ name: input.name.trim(), email, passwordHash }],
        { session: dbSession },
      );

      const [organization] = await Organization.create(
        [{ name: input.organizationName.trim(), slug, ownerId: user._id }],
        { session: dbSession },
      );

      user.activeOrganizationId = organization._id;
      await user.save({ session: dbSession });

      await Membership.create(
        [{ userId: user._id, organizationId: organization._id, role: "owner" }],
        { session: dbSession },
      );

      result = {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        organizationId: organization._id.toString(),
        organizationName: organization.name,
        role: "owner",
      };
    });
    if (!result) throw new AppError("INTERNAL_ERROR", "Failed to create account.", 500);
    return result;
  } finally {
    await dbSession.endSession();
  }
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginWithPassword(input: LoginInput): Promise<AuthResult> {
  await connectToDatabase();

  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const membership =
    (user.activeOrganizationId &&
      (await Membership.findOne({
        userId: user._id,
        organizationId: user.activeOrganizationId,
      }))) ||
    (await Membership.findOne({ userId: user._id }).sort({ createdAt: 1 }));

  if (!membership) {
    throw new AppError(
      "FORBIDDEN",
      "This account is not linked to any organization.",
      403,
    );
  }

  if (String(user.activeOrganizationId) !== String(membership.organizationId)) {
    user.activeOrganizationId = membership.organizationId;
    await user.save();
  }

  const organization = await Organization.findById(membership.organizationId);
  if (!organization) {
    throw new AppError("NOT_FOUND", "Organization not found.", 404);
  }

  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    organizationId: organization._id.toString(),
    organizationName: organization.name,
    role: membership.role as Role,
  };
}
