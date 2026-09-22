import { z } from "zod";
import { paginationQuerySchema } from "@/lib/validation/pagination";
import { DOCUMENT_STATUSES, SUPPORTED_DOCUMENT_TYPES } from "@/models/Document";

export const documentQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  documentType: z.enum(SUPPORTED_DOCUMENT_TYPES).optional(),
});

export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;

export const knowledgeSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(300),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});
