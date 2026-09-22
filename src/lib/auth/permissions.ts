import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { roleAtLeast, type Role } from "@/models/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/guards";

/**
 * Centralized permission matrix: the minimum role required for each
 * operation. AI tools (Phase 3) and route handlers both funnel through
 * `can()` / `requirePermission()` so authorization logic lives in one place.
 */
export const PERMISSIONS = {
  "products.read": "viewer",
  "products.create": "manager",
  "products.update": "manager",
  "products.delete": "manager",

  "inventory.read": "viewer",
  "inventory.adjust": "staff",

  "customers.read": "viewer",
  "customers.create": "manager",
  "customers.update": "manager",
  "customers.delete": "manager",

  "suppliers.read": "viewer",
  "suppliers.create": "manager",
  "suppliers.update": "manager",
  "suppliers.delete": "manager",

  "quotations.read": "viewer",
  "quotations.create": "staff",
  "quotations.update": "staff",
  "quotations.delete": "manager",
  "quotations.approve": "admin",

  "knowledge.read": "viewer",
  "knowledge.create": "manager",
  "knowledge.delete": "manager",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSIONS[permission]);
}

/** Throws a 403 AppError when the session's role lacks the given permission. Use in route handlers and services. */
export function requirePermission(session: SessionPayload, permission: Permission): void {
  if (!can(session.role, permission)) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to perform this action.",
      403,
    );
  }
}

/** Server Component variant: redirects instead of throwing. */
export async function requirePagePermission(permission: Permission): Promise<SessionPayload> {
  const session = await requireSession();
  if (!can(session.role, permission)) {
    redirect("/dashboard?error=forbidden");
  }
  return session;
}
