import { z } from "zod";
import { paginationQuerySchema } from "@/lib/validation/pagination";
import { STOCK_MOVEMENT_REFERENCE_TYPES } from "@/models/StockMovement";

export const inventoryQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "all"]).optional().default("all"),
});

export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;

/** Manual stock adjustment — the only movement type a user can trigger directly from the UI. */
export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  notes: z.string().trim().max(500).optional().default(""),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const stockMovementQuerySchema = paginationQuerySchema.extend({
  productId: z.string().optional(),
  type: z.string().optional(),
  referenceType: z.enum(STOCK_MOVEMENT_REFERENCE_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type StockMovementQueryInput = z.infer<typeof stockMovementQuerySchema>;
