import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { searchProducts as searchProductsService } from "@/services/product.service";
import {
  getLowStockProducts as getLowStockProductsService,
  checkStockAvailability as checkStockAvailabilityService,
  previewStockAdjustment,
} from "@/services/inventory.service";
import { listStockMovements } from "@/services/stock-movement.service";
import { AppError } from "@/lib/errors";
import type { ToolContext, ToolRegistryEntry } from "@/ai/types";
import { checkToolPermission } from "@/ai/tools/shared";
import { createPendingAction } from "@/ai/actions/action-manager";
import { writeActionRateLimiter } from "@/ai/services/rate-limit-service";

export const INVENTORY_TOOL_REGISTRY: ToolRegistryEntry[] = [
  {
    name: "getLowStockProducts",
    description: "List products at or below their low-stock threshold.",
    category: "INVENTORY",
    permission: "inventory.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "checkStockAvailability",
    description: "Check whether enough stock is available for a given product and quantity.",
    category: "INVENTORY",
    permission: "inventory.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "getProductStock",
    description: "Look up current stock for a product by name (no need to search first).",
    category: "INVENTORY",
    permission: "inventory.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "getStockMovements",
    description: "List recent stock movements, optionally filtered to one product.",
    category: "INVENTORY",
    permission: "inventory.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "adjustStock",
    description: "Prepare a manual stock adjustment for user confirmation (does not apply it automatically).",
    category: "INVENTORY",
    permission: "inventory.adjust",
    mode: "write",
    requiresConfirmation: true,
  },
];

/**
 * Resolves a free-text product name to zero, one, or many product matches.
 * Shared by getProductStock and getStockMovements so both give the model the
 * same "ambiguous — ask the user" signal instead of guessing a product.
 */
async function resolveOneProduct(organizationId: string, query: string) {
  const results = await searchProductsService(organizationId, query, 6);
  if (results.length === 0) {
    return { status: "not_found" as const };
  }
  const exactMatch = results.find((p) => p.itemName.toLowerCase() === query.trim().toLowerCase());
  if (exactMatch) {
    return { status: "found" as const, product: exactMatch };
  }
  if (results.length === 1) {
    return { status: "found" as const, product: results[0] };
  }
  return {
    status: "ambiguous" as const,
    candidates: results.map((p) => ({ productId: p.productId, itemCode: p.itemCode, itemName: p.itemName })),
  };
}

export function createInventoryTools(context: ToolContext): ToolSet {
  return {
    getLowStockProducts: tool({
      description:
        "Get products that are at or below their configured low-stock threshold, including out-of-stock products. Use this for questions like 'which products are low in stock'.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional().default(50).describe("Maximum number of products to return"),
      }),
      execute: async ({ limit }) => {
        const denied = checkToolPermission(context, "inventory.read");
        if (denied) return denied;

        const products = await getLowStockProductsService(context.organizationId, limit);
        return {
          count: products.length,
          products: products.map((p) => ({
            productId: p.productId,
            itemCode: p.itemCode,
            itemName: p.itemName,
            currentStock: p.currentStock,
            lowStockThreshold: p.lowStockThreshold,
            difference: p.currentStock - p.lowStockThreshold,
            stockStatus: p.stockStatus,
          })),
        };
      },
    }),

    checkStockAvailability: tool({
      description:
        "Check whether a specific quantity of a product is available in stock, given its productId (from a prior searchProducts call) and the desired quantity.",
      inputSchema: z.object({
        productId: z.string().min(1).describe("The product's id, from a prior searchProducts result"),
        quantity: z.number().int().min(1).describe("The quantity to check availability for"),
      }),
      execute: async ({ productId, quantity }) => {
        const denied = checkToolPermission(context, "inventory.read");
        if (denied) return denied;

        const result = await checkStockAvailabilityService(context.organizationId, productId, quantity);
        return { ...result, requestedQuantity: quantity };
      },
    }),

    getProductStock: tool({
      description:
        "Look up current stock for a product by name in one step, e.g. 'how many Safety Helmets do we have'. If the name matches more than one product, returns candidates instead of guessing — ask the user which one they mean.",
      inputSchema: z.object({
        query: z.string().min(1).max(100).describe("The product name to look up stock for"),
      }),
      execute: async ({ query }) => {
        const denied = checkToolPermission(context, "inventory.read");
        if (denied) return denied;

        const resolved = await resolveOneProduct(context.organizationId, query);
        if (resolved.status === "not_found") {
          return { status: "not_found", message: `No product matching "${query}" was found.` };
        }
        if (resolved.status === "ambiguous") {
          return { status: "ambiguous", candidates: resolved.candidates };
        }
        return {
          status: "found",
          product: {
            productId: resolved.product.productId,
            itemCode: resolved.product.itemCode,
            itemName: resolved.product.itemName,
            currentStock: resolved.product.currentStock,
            uom: resolved.product.uom,
          },
        };
      },
    }),

    getStockMovements: tool({
      description:
        "List recent stock movements (purchases, sales, adjustments, returns), optionally filtered to one product by name.",
      inputSchema: z.object({
        productQuery: z.string().max(100).optional().describe("Optional product name to filter movements to"),
        limit: z.number().int().min(1).max(50).optional().default(10),
      }),
      execute: async ({ productQuery, limit }) => {
        const denied = checkToolPermission(context, "inventory.read");
        if (denied) return denied;

        let productId: string | undefined;
        if (productQuery) {
          const resolved = await resolveOneProduct(context.organizationId, productQuery);
          if (resolved.status === "not_found") {
            return { status: "not_found", message: `No product matching "${productQuery}" was found.` };
          }
          if (resolved.status === "ambiguous") {
            return { status: "ambiguous", candidates: resolved.candidates };
          }
          productId = resolved.product.productId;
        }

        const { data } = await listStockMovements(context.organizationId, {
          page: 1,
          limit,
          productId,
        });

        return {
          count: data.length,
          movements: data.map((m) => ({
            itemCode: m.itemCode,
            itemName: m.itemName,
            type: m.type,
            quantity: m.quantity,
            previousStock: m.previousStock,
            newStock: m.newStock,
            createdAt: m.createdAt,
          })),
        };
      },
    }),

    /**
     * Write tool. Like createQuotation, `execute` only ever reads
     * (previewStockAdjustment performs no writes) and persists a
     * PendingAction — the actual stock write happens only when the user
     * confirms, via POST /api/ai/actions/[id]/confirm.
     */
    adjustStock: tool({
      description:
        "Prepare a manual stock adjustment (correcting a stock count, recording found/lost/damaged units, etc.) for the user to review and confirm. Call this only after resolving the productId (via searchProducts or getProductStock). This does NOT change stock — it only prepares a preview for the user to confirm.",
      inputSchema: z.object({
        productId: z.string().min(1).describe("The product's id, from a prior searchProducts/getProductStock call"),
        direction: z.enum(["IN", "OUT"]).describe("IN increases stock, OUT decreases it"),
        quantity: z.number().int().min(1),
        notes: z.string().max(500).optional().describe("Reason for the adjustment, e.g. 'physical count correction'"),
      }),
      execute: async ({ productId, direction, quantity, notes }) => {
        const denied = checkToolPermission(context, "inventory.adjust");
        if (denied) return denied;

        const rateLimit = await writeActionRateLimiter.check(context.organizationId);
        if (!rateLimit.allowed) {
          return {
            status: "error" as const,
            message: "Your organization has proposed too many write actions in the last minute. Please wait a moment and try again.",
          };
        }

        try {
          const preview = await previewStockAdjustment(context.organizationId, { productId, direction, quantity, notes });

          const pendingAction = await createPendingAction({
            organizationId: context.organizationId,
            userId: context.userId,
            conversationId: context.conversationId,
            actionType: "ADJUST_STOCK",
            toolName: "adjustStock",
            requiredPermission: "inventory.adjust",
            validatedArguments: { productId, direction, quantity, notes },
            preview: preview as unknown as Record<string, unknown>,
          });

          return {
            status: "pending_confirmation" as const,
            actionId: pendingAction.actionId,
            expiresAt: pendingAction.expiresAt,
            preview,
          };
        } catch (error) {
          if (error instanceof AppError) {
            return { status: "error" as const, message: error.message };
          }
          throw error;
        }
      },
    }),
  };
}
