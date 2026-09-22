import { z } from "zod";
import { tool, type ToolSet } from "ai";
import {
  searchCustomers as searchCustomersService,
  getCustomer as getCustomerService,
  getCustomerPurchaseHistory as getCustomerPurchaseHistoryService,
} from "@/services/customer.service";
import { AppError } from "@/lib/errors";
import type { ToolContext, ToolRegistryEntry } from "@/ai/types";
import { checkToolPermission } from "@/ai/tools/shared";

export const CUSTOMER_TOOL_REGISTRY: ToolRegistryEntry[] = [
  {
    name: "searchCustomers",
    description: "Search customers by name, company, email, or phone.",
    category: "CUSTOMERS",
    permission: "customers.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "getCustomer",
    description: "Get full details for one customer by id.",
    category: "CUSTOMERS",
    permission: "customers.read",
    mode: "read",
    requiresConfirmation: false,
  },
  {
    name: "getCustomerPurchaseHistory",
    description: "List a customer's quotation history.",
    category: "CUSTOMERS",
    permission: "customers.read",
    mode: "read",
    requiresConfirmation: false,
  },
];

export function createCustomerTools(context: ToolContext): ToolSet {
  return {
    searchCustomers: tool({
      description:
        "Search the organization's customers by name, company name, email, or phone. Use this first when the user refers to a customer by name so you can resolve it to a customerId.",
      inputSchema: z.object({
        query: z.string().min(1).max(100).describe("Customer or company name to search for"),
      }),
      execute: async ({ query }) => {
        const denied = checkToolPermission(context, "customers.read");
        if (denied) return denied;

        const results = await searchCustomersService(context.organizationId, query, 10);
        return { count: results.length, customers: results };
      },
    }),

    getCustomer: tool({
      description: "Get full details for a single customer, given its customerId (from a prior searchCustomers call).",
      inputSchema: z.object({
        customerId: z.string().min(1).describe("The customer's id, from a prior searchCustomers result"),
      }),
      execute: async ({ customerId }) => {
        const denied = checkToolPermission(context, "customers.read");
        if (denied) return denied;

        try {
          const customer = await getCustomerService(context.organizationId, customerId);
          return {
            found: true,
            customer: {
              customerId: customer._id.toString(),
              customerCode: customer.customerCode,
              name: customer.name,
              companyName: customer.companyName,
              email: customer.email,
              phone: customer.phone,
              creditLimit: customer.creditLimit,
              paymentTerms: customer.paymentTerms,
              isActive: customer.isActive,
            },
          };
        } catch (error) {
          if (error instanceof AppError && error.code === "CUSTOMER_NOT_FOUND") {
            return { found: false, message: "No customer found with that id." };
          }
          throw error;
        }
      },
    }),

    getCustomerPurchaseHistory: tool({
      description: "List a customer's quotation history (quotation number, status, total, date), given their customerId.",
      inputSchema: z.object({
        customerId: z.string().min(1).describe("The customer's id, from a prior searchCustomers/getCustomer call"),
      }),
      execute: async ({ customerId }) => {
        const denied = checkToolPermission(context, "customers.read");
        if (denied) return denied;

        const history = await getCustomerPurchaseHistoryService(context.organizationId, customerId, 20);
        return { count: history.length, quotations: history };
      },
    }),
  };
}
