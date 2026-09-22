export const ROLES = ["owner", "admin", "manager", "staff", "viewer"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Coarse-grained permission set enforced server-side on every protected
 * operation. Kept intentionally small in Phase 1 — business-data permissions
 * (inventory:write, quotations:write, etc.) are layered on in later phases.
 */
export const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  staff: 2,
  viewer: 1,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
