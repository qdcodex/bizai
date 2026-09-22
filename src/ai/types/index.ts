import type { Role } from "@/models/roles";

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
