import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { searchProducts as searchProductsService, getProduct as getProductService } from "@/services/product.service";
import { AppError } from "@/lib/errors";
import type { ToolContext, ToolRegistryEntry } from "@/ai/types";
import { checkToolPermission } from "@/ai/tools/shared";

export const PRODUCT_TOOL_REGISTRY: ToolRegistryEntry[] = [
  {
    name: "searchProducts",
    description: "Search the product catalog by name, item code, or part number.",
    category: "PRODUCTS",
    permission: "products.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "getProduct",
    description: "Get full details for one product by its id.",
    category: "PRODUCTS",
    permission: "products.read",
    mode: "read",
    requiresConfirmation: false,
  },
];

export function createProductTools(context: ToolContext): ToolSet {
  return {
    searchProducts: tool({
      description:
        "Search the organization's product catalog by name, item code, or part number. Use this first when the user refers to a product by name so you can resolve it to a productId.",
      inputSchema: z.object({
        query: z.string().min(1).max(100).describe("Product name, item code, or part number to search for"),
      }),
      execute: async ({ query }) => {
        const denied = checkToolPermission(context, "products.read");
        if (denied) return denied;

        const results = await searchProductsService(context.organizationId, query, 10);
        return {
          count: results.length,
          products: results.map((p) => ({
            productId: p.productId,
            itemCode: p.itemCode,
            itemName: p.itemName,
            uom: p.uom,
            sellingPrice: p.sellingPrice,
            currentStock: p.currentStock,
          })),
        };
      },
    }),

    getProduct: tool({
      description: "Get full details for a single product, given its productId (from a prior searchProducts call).",
      inputSchema: z.object({
        productId: z.string().min(1).describe("The product's id, from a prior searchProducts result"),
      }),
      execute: async ({ productId }) => {
        const denied = checkToolPermission(context, "products.read");
        if (denied) return denied;

        try {
          const product = await getProductService(context.organizationId, productId);
          return {
            found: true,
            product: {
              productId: product._id.toString(),
              itemCode: product.itemCode,
              itemName: product.itemName,
              description: product.description,
              category: product.category,
              brand: product.brand,
              partNumber: product.partNumber,
              uom: product.uom,
              sellingPrice: product.sellingPrice,
              minSellingPrice: product.minSellingPrice,
              isActive: product.isActive,
            },
          };
        } catch (error) {
          if (error instanceof AppError && error.code === "PRODUCT_NOT_FOUND") {
            return { found: false, message: "No product found with that id." };
          }
          throw error;
        }
      },
    }),
  };
}
