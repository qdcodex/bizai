import type { Role } from "@/models/roles";
import type { ModuleVisibility } from "@/lib/auth/modules";

/**
 * Server-resolved context injected into every tool via closure over the
 * authenticated session. Never derived from model output — the LLM never
 * sees or chooses these values.
 */
export interface ToolContext {
  organizationId: string;
  userId: string;
  role: Role;
  conversationId: string;
  /** The org's Module Access setting; tools for modules hidden from this role are excluded. Omitted = all visible. */
  moduleVisibility?: ModuleVisibility;
}

export type ToolMode = "read" | "write";

export const TOOL_CATEGORIES = [
  "PRODUCTS",
  "INVENTORY",
  "CUSTOMERS",
  "SUPPLIERS",
  "QUOTATIONS",
  "KNOWLEDGE",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** Static metadata describing a tool for the tool registry (permission classification). */
export interface ToolRegistryEntry {
  name: string;
  description: string;
  category: ToolCategory;
  permission: string;
  mode: ToolMode;
  requiresConfirmation: boolean;
}
