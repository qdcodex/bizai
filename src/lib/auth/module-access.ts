import { connectToDatabase } from "@/lib/db/connect";
import { Organization } from "@/models/Organization";
import { isModuleVisible, type ModuleKey, type ModuleVisibility } from "@/lib/auth/modules";
import type { Role } from "@/models/roles";

/** Server-only: loads the org's module visibility setting (a small, _id-indexed read). */
export async function getModuleVisibility(organizationId: string): Promise<ModuleVisibility> {
  await connectToDatabase();
  const organization = await Organization.findById(organizationId).select("settings.moduleVisibility").lean();
  return organization?.settings?.moduleVisibility ?? {};
}

export async function canAccessModule(organizationId: string, role: Role, moduleKey: ModuleKey): Promise<boolean> {
  if (role === "owner") return true;
  return isModuleVisible(await getModuleVisibility(organizationId), role, moduleKey);
}

/** API path prefixes that belong to a gated module — enforced centrally in src/proxy.ts. */
export const MODULE_API_PREFIXES: ReadonlyArray<readonly [string, ModuleKey]> = [
  ["/api/inventory", "inventory"],
  ["/api/customers", "customers"],
  ["/api/suppliers", "suppliers"],
  ["/api/quotations", "quotations"],
  ["/api/knowledge", "knowledge"],
];

export function moduleForApiPath(pathname: string): ModuleKey | null {
  const match = MODULE_API_PREFIXES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}
