import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { searchSuppliers as searchSuppliersService, getSupplier as getSupplierService } from "@/services/supplier.service";
import { AppError } from "@/lib/errors";
import type { ToolContext, ToolRegistryEntry } from "@/ai/types";
import { checkToolPermission } from "@/ai/tools/shared";

export const SUPPLIER_TOOL_REGISTRY: ToolRegistryEntry[] = [
  {
    name: "searchSuppliers",
    description: "Search suppliers by name, company, email, or phone.",
    category: "SUPPLIERS",
    permission: "suppliers.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "getSupplier",
    description: "Get full details for one supplier by id.",
    category: "SUPPLIERS",
    permission: "suppliers.read",
    mode: "read",
    requiresConfirmation: false,
  },
];

export function createSupplierTools(context: ToolContext): ToolSet {
  return {
    searchSuppliers: tool({
      description:
        "Search the organization's suppliers by name, company name, email, or phone. Use this first when the user refers to a supplier by name so you can resolve it to a supplierId.",
      inputSchema: z.object({
        query: z.string().min(1).max(100).describe("Supplier or company name to search for"),
      }),
      execute: async ({ query }) => {
        const denied = checkToolPermission(context, "suppliers.read");
        if (denied) return denied;

        const results = await searchSuppliersService(context.organizationId, query, 10);
        return { count: results.length, suppliers: results };
      },
    }),

    getSupplier: tool({
      description: "Get full details for a single supplier, given its supplierId (from a prior searchSuppliers call).",
      inputSchema: z.object({
        supplierId: z.string().min(1).describe("The supplier's id, from a prior searchSuppliers result"),
      }),
      execute: async ({ supplierId }) => {
        const denied = checkToolPermission(context, "suppliers.read");
        if (denied) return denied;

        try {
          const supplier = await getSupplierService(context.organizationId, supplierId);
          return {
            found: true,
            supplier: {
              supplierId: supplier._id.toString(),
              supplierCode: supplier.supplierCode,
              name: supplier.name,
              companyName: supplier.companyName,
              email: supplier.email,
              phone: supplier.phone,
              paymentTerms: supplier.paymentTerms,
              isActive: supplier.isActive,
            },
          };
        } catch (error) {
          if (error instanceof AppError && error.code === "SUPPLIER_NOT_FOUND") {
            return { found: false, message: "No supplier found with that id." };
          }
          throw error;
        }
      },
    }),
  };
}
