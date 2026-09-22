import { z } from "zod";
import { paginationQuerySchema } from "@/lib/validation/pagination";
import { QUOTATION_STATUSES } from "@/models/Quotation";

/**
 * A line item as submitted by the client. `unitPrice` is optional — when
 * omitted the server prices it from the product's current selling price.
 * discount/tax are flat monetary amounts per line, not percentages.
 */
export const quotationItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional().default(0),
  tax: z.coerce.number().min(0).optional().default(0),
});

export type QuotationItemInput = z.infer<typeof quotationItemInputSchema>;

export const quotationCreateSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  items: z.array(quotationItemInputSchema).min(1, "Add at least one item"),
  validUntil: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional().default(""),
  /** Explicit acknowledgement from an authorized role to allow a line below minSellingPrice. */
  overrideMinPrice: z.boolean().optional().default(false),
});

export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;

export const quotationUpdateSchema = z.object({
  customerId: z.string().min(1).optional(),
  items: z.array(quotationItemInputSchema).min(1).optional(),
  validUntil: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  overrideMinPrice: z.boolean().optional().default(false),
});

export type QuotationUpdateInput = z.infer<typeof quotationUpdateSchema>;

export const quotationQuerySchema = paginationQuerySchema.extend({
  status: z.enum(QUOTATION_STATUSES).optional(),
  customerId: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type QuotationQueryInput = z.infer<typeof quotationQuerySchema>;

export const quotationRejectSchema = z.object({
  reason: z.string().trim().max(1000).optional().default(""),
});
