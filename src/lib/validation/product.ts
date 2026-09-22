import { z } from "zod";
import { paginationQuerySchema } from "@/lib/validation/pagination";

const moneyField = z.coerce.number().min(0, "Must be zero or greater");

export const productCreateSchema = z
  .object({
    itemCode: z.string().trim().min(1, "Item code is required").max(40),
    itemName: z.string().trim().min(1, "Item name is required").max(200),
    description: z.string().trim().max(2000).optional().default(""),
    category: z.string().trim().max(100).optional().default(""),
    brand: z.string().trim().max(100).optional().default(""),
    partNumber: z.string().trim().max(100).optional().default(""),
    uom: z.string().trim().min(1).max(20).optional().default("unit"),
    costPrice: moneyField,
    sellingPrice: moneyField,
    minSellingPrice: moneyField,
    lowStockThreshold: z.coerce.number().int().min(0).optional().default(10),
    imageUrl: z.string().trim().max(2000).optional().default(""),
    isActive: z.boolean().optional().default(true),
  })
  .refine((data) => data.sellingPrice >= data.minSellingPrice, {
    message: "Selling price cannot be lower than the minimum selling price.",
    path: ["sellingPrice"],
  });

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = z.object({
  itemCode: z.string().trim().min(1).max(40).optional(),
  itemName: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  partNumber: z.string().trim().max(100).optional(),
  uom: z.string().trim().min(1).max(20).optional(),
  costPrice: moneyField.optional(),
  sellingPrice: moneyField.optional(),
  minSellingPrice: moneyField.optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const productQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  status: z.enum(["active", "inactive", "all"]).optional().default("active"),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "all"]).optional().default("all"),
  sortBy: z
    .enum(["itemName", "itemCode", "costPrice", "sellingPrice", "createdAt"])
    .optional()
    .default("itemName"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

export const productSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
