import { z } from "zod";
import { paginationQuerySchema } from "@/lib/validation/pagination";

export const supplierCreateSchema = z.object({
  supplierCode: z.string().trim().min(1, "Supplier code is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(200),
  companyName: z.string().trim().max(200).optional().default(""),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")).default(""),
  phone: z.string().trim().max(30).optional().default(""),
  taxNumber: z.string().trim().max(60).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  country: z.string().trim().max(100).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  paymentTerms: z.string().trim().max(60).optional().default("Net 30"),
  isActive: z.boolean().optional().default(true),
});

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;

export const supplierUpdateSchema = supplierCreateSchema.partial();
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

export const supplierQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["active", "inactive", "all"]).optional().default("active"),
});

export type SupplierQueryInput = z.infer<typeof supplierQuerySchema>;

export const supplierSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
