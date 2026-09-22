import { TOOL_REGISTRY } from "@/ai/tools";
import type { ToolCategory, ToolRegistryEntry } from "@/ai/types";

/** Read-only helpers over the registry assembled in src/ai/tools/index.ts — the actual tool implementations stay there. */
export function getAllToolEntries(): ToolRegistryEntry[] {
  return TOOL_REGISTRY;
}

export function getToolEntry(name: string): ToolRegistryEntry | undefined {
  return TOOL_REGISTRY.find((entry) => entry.name === name);
}

export function getToolsByCategory(category: ToolCategory): ToolRegistryEntry[] {
  return TOOL_REGISTRY.filter((entry) => entry.category === category);
}

export function isWriteTool(name: string): boolean {
  return getToolEntry(name)?.mode === "write";
}

export function toolRequiresConfirmation(name: string): boolean {
  return getToolEntry(name)?.requiresConfirmation ?? false;
}
