import type { ToolSet } from "ai";
import { can, type Permission } from "@/lib/auth/permissions";
import { isModuleVisible, type ModuleKey } from "@/lib/auth/modules";
import type { ToolCategory, ToolContext, ToolRegistryEntry } from "@/ai/types";
import { createProductTools, PRODUCT_TOOL_REGISTRY } from "@/ai/tools/product-tools";
import { createInventoryTools, INVENTORY_TOOL_REGISTRY } from "@/ai/tools/inventory-tools";
import { createCustomerTools, CUSTOMER_TOOL_REGISTRY } from "@/ai/tools/customer-tools";
import { createSupplierTools, SUPPLIER_TOOL_REGISTRY } from "@/ai/tools/supplier-tools";
import { createQuotationTools, QUOTATION_TOOL_REGISTRY } from "@/ai/tools/quotation-tools";
import { createKnowledgeTools, KNOWLEDGE_TOOL_REGISTRY } from "@/ai/tools/knowledge-tools";

/** Full tool registry — permission classification for every AI tool, read or write. */
export const TOOL_REGISTRY: ToolRegistryEntry[] = [
  ...PRODUCT_TOOL_REGISTRY,
  ...INVENTORY_TOOL_REGISTRY,
  ...CUSTOMER_TOOL_REGISTRY,
  ...SUPPLIER_TOOL_REGISTRY,
  ...QUOTATION_TOOL_REGISTRY,
  ...KNOWLEDGE_TOOL_REGISTRY,
];

const REGISTRY_BY_NAME = new Map(TOOL_REGISTRY.map((entry) => [entry.name, entry]));

/** Which Module Access toggle governs each tool category. PRODUCTS isn't a hideable module. */
const CATEGORY_MODULE: Partial<Record<ToolCategory, ModuleKey>> = {
  INVENTORY: "inventory",
  CUSTOMERS: "customers",
  SUPPLIERS: "suppliers",
  QUOTATIONS: "quotations",
  KNOWLEDGE: "knowledge",
};

/**
 * Builds the toolset available to the model for this request. Tools are
 * assembled fresh per request, with the authenticated session captured in
 * closure — the model never supplies organizationId/userId itself. Tools the
 * current role cannot use are left out of the set entirely (the model isn't
 * even told they exist), on top of the per-tool permission check each tool
 * still runs in its own `execute` as defense in depth.
 */
export function buildTools(context: ToolContext): ToolSet {
  const allTools: ToolSet = {
    ...createProductTools(context),
    ...createInventoryTools(context),
    ...createCustomerTools(context),
    ...createSupplierTools(context),
    ...createQuotationTools(context),
    ...createKnowledgeTools(context),
  };

  const allowed: ToolSet = {};
  for (const [name, toolDef] of Object.entries(allTools)) {
    const entry = REGISTRY_BY_NAME.get(name);
    if (!entry) continue; // unregistered tool — fail closed
    if (!can(context.role, entry.permission as Permission)) continue;
    const moduleKey = CATEGORY_MODULE[entry.category];
    if (moduleKey && !isModuleVisible(context.moduleVisibility, context.role, moduleKey)) continue;
    allowed[name] = toolDef;
  }
  return allowed;
}
