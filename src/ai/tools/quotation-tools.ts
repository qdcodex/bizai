import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { QUOTATION_STATUSES } from "@/models/Quotation";
import {
  searchQuotations as searchQuotationsService,
  getQuotation as getQuotationService,
  previewQuotation,
} from "@/services/quotation.service";
import { AppError } from "@/lib/errors";
import type { ToolContext, ToolRegistryEntry } from "@/ai/types";
import { checkToolPermission } from "@/ai/tools/shared";
import { createPendingAction } from "@/ai/actions/action-manager";
import { writeActionRateLimiter } from "@/ai/services/rate-limit-service";

export const QUOTATION_TOOL_REGISTRY: ToolRegistryEntry[] = [
  {
    name: "searchQuotations",
    description: "Search quotations by number, status, or customer.",
    category: "QUOTATIONS",
    permission: "quotations.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "getQuotation",
    description: "Get full details for one quotation by its quotation number.",
    category: "QUOTATIONS",
    permission: "quotations.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "createQuotation",
    description: "Prepare a new quotation for user confirmation (does not create it automatically).",
    category: "QUOTATIONS",
    permission: "quotations.create",
    mode: "write",
    requiresConfirmation: true,
  },
];

export function createQuotationTools(context: ToolContext): ToolSet {
  return {
    searchQuotations: tool({
      description:
        "Search quotations by quotation number, status (e.g. PENDING_APPROVAL, APPROVED, DRAFT), and/or customerId. Use this for questions like 'show my pending quotations'.",
      inputSchema: z.object({
        query: z.string().max(100).optional().describe("Quotation number to search for, if known"),
        status: z.enum(QUOTATION_STATUSES).optional().describe("Filter by quotation status"),
        customerId: z.string().optional().describe("Filter to one customer's quotations, from a prior searchCustomers call"),
        limit: z.number().int().min(1).max(50).optional().default(10),
      }),
      execute: async ({ query, status, customerId, limit }) => {
        const denied = checkToolPermission(context, "quotations.read");
        if (denied) return denied;

        const results = await searchQuotationsService(context.organizationId, {
          q: query,
          status,
          customerId,
          limit,
        });
        return { count: results.length, quotations: results };
      },
    }),

    getQuotation: tool({
      description: "Get full details (items, totals, status, customer) for a single quotation by its quotation number, e.g. QT-2026-000012.",
      inputSchema: z.object({
        quotationNumber: z.string().min(1).describe("The quotation number, e.g. QT-2026-000012"),
      }),
      execute: async ({ quotationNumber }) => {
        const denied = checkToolPermission(context, "quotations.read");
        if (denied) return denied;

        const matches = await searchQuotationsService(context.organizationId, { q: quotationNumber, limit: 5 });
        const exact = matches.find((m) => m.quotationNumber.toLowerCase() === quotationNumber.trim().toLowerCase());
        if (!exact) {
          if (matches.length > 0) {
            return {
              status: "ambiguous",
              candidates: matches.map((m) => ({ quotationNumber: m.quotationNumber, customerName: m.customerName })),
            };
          }
          return { status: "not_found", message: `No quotation found with number "${quotationNumber}".` };
        }

        try {
          const quotation = await getQuotationService(context.organizationId, exact.quotationId);
          return { status: "found", quotation };
        } catch (error) {
          if (error instanceof AppError && error.code === "QUOTATION_NOT_FOUND") {
            return { status: "not_found", message: `No quotation found with number "${quotationNumber}".` };
          }
          throw error;
        }
      },
    }),

    /**
     * Write tool. `execute` only ever reads (previewQuotation performs no
     * writes) and persists a PendingAction — the LLM never calls the real
     * createQuotation service directly. The tool call therefore always
     * resolves immediately with a `pending_confirmation` result the client
     * renders as a confirmation card; the actual business write happens only
     * when the user clicks Confirm, via POST /api/ai/actions/[id]/confirm
     * (see src/ai/actions/action-manager.ts), never from this function.
     */
    createQuotation: tool({
      description:
        "Prepare a quotation for the user to review and confirm. Call this only after you have resolved the customerId (via searchCustomers) and each productId (via searchProducts), and have asked the user for anything still missing (customer, at least one product, and quantities). This does NOT create the quotation — it only prepares a preview for the user to confirm.",
      inputSchema: z.object({
        customerId: z.string().min(1).describe("The customer's id, from a prior searchCustomers call"),
        items: z
          .array(
            z.object({
              productId: z.string().min(1).describe("The product's id, from a prior searchProducts call"),
              quantity: z.number().int().min(1),
              unitPrice: z.number().min(0).optional().describe("Only set this if the user requested a specific price"),
            }),
          )
          .min(1),
        notes: z.string().max(2000).optional(),
      }),
      execute: async ({ customerId, items, notes }) => {
        const denied = checkToolPermission(context, "quotations.create");
        if (denied) return denied;

        const rateLimit = await writeActionRateLimiter.check(context.organizationId);
        if (!rateLimit.allowed) {
          return {
            status: "error" as const,
            message: "Your organization has proposed too many write actions in the last minute. Please wait a moment and try again.",
          };
        }

        try {
          const preview = await previewQuotation(
            { organizationId: context.organizationId, userId: context.userId, role: context.role },
            { customerId, items, notes },
          );

          const validatedArguments = {
            customerId,
            items,
            notes,
            overrideMinPrice: preview.hasItemsBelowMinPrice && preview.canOverrideMinPrice,
          };

          const pendingAction = await createPendingAction({
            organizationId: context.organizationId,
            userId: context.userId,
            conversationId: context.conversationId,
            actionType: "CREATE_QUOTATION",
            toolName: "createQuotation",
            requiredPermission: "quotations.create",
            validatedArguments,
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
