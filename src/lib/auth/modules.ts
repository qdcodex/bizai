import type { Role } from "@/models/roles";

/**
 * The organization's optional, hideable modules. Each maps to the
 * permission prefix its pages already gate on (e.g. "inventory.read"), so
 * `requirePagePermission` can derive module visibility from the same
 * string every existing page already passes it — no page files need to
 * change. Invoices reuses the "quotations" prefix since it's the same
 * underlying data (converted quotations), so the two are one toggle.
 * Dashboard, AI Assistant, and Settings are core navigation and are never
 * hideable.
 */
export const GATED_MODULES = [
  { key: "inventory", label: "Inventory", permissionPrefix: "inventory" },
  { key: "customers", label: "Customers", permissionPrefix: "customers" },
  { key: "suppliers", label: "Suppliers", permissionPrefix: "suppliers" },
  { key: "quotations", label: "Quotations & Invoices", permissionPrefix: "quotations" },
  { key: "knowledge", label: "Knowledge Base", permissionPrefix: "knowledge" },
] as const;

export type ModuleKey = (typeof GATED_MODULES)[number]["key"];
export const MODULE_KEYS = GATED_MODULES.map((m) => m.key) as ModuleKey[];

/** Roles whose module access can be restricted. Owner always has full access and is never configurable. */
export const CONFIGURABLE_ROLES = ["admin", "manager", "staff", "viewer"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export type ModuleVisibility = Partial<Record<Role, string[]>>;

/** A role missing from the map means "not configured" -> defaults to fully visible, for backward compatibility. */
export function isModuleVisible(moduleVisibility: ModuleVisibility | undefined, role: Role, moduleKey: string): boolean {
  if (role === "owner") return true;
  const list = moduleVisibility?.[role];
  if (!list) return true;
  return list.includes(moduleKey);
}

/** Maps a permission string like "inventory.read" to its gated module key, or null if that permission isn't module-gated. */
export function permissionPrefixToModuleKey(permission: string): ModuleKey | null {
  const prefix = permission.split(".")[0];
  const found = GATED_MODULES.find((m) => m.permissionPrefix === prefix);
  return found ? found.key : null;
}
