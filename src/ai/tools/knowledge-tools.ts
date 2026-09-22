import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { searchKnowledgeBase as searchKnowledgeBaseService } from "@/ai/rag/retrieval-service";
import type { ToolContext, ToolRegistryEntry } from "@/ai/types";
import { checkToolPermission } from "@/ai/tools/shared";

export const KNOWLEDGE_TOOL_REGISTRY: ToolRegistryEntry[] = [
  {
    name: "searchKnowledgeBase",
    description: "Search uploaded company documents (policies, manuals, catalogues) for relevant passages.",
    category: "KNOWLEDGE",
    permission: "knowledge.read",
    mode: "read",
    requiresConfirmation: false,
  },
];

export function createKnowledgeTools(context: ToolContext): ToolSet {
  return {
    searchKnowledgeBase: tool({
      description:
        "Search the organization's uploaded documents (policies, manuals, catalogues, price lists, terms & conditions) for content relevant to a question. Use this for questions about company documents or policies — e.g. warranty terms, installation steps, return conditions — NOT for live business data like current stock or prices, which have their own tools.",
      inputSchema: z.object({
        query: z.string().min(1).max(300).describe("The question or topic to search the knowledge base for"),
      }),
      execute: async ({ query }) => {
        const denied = checkToolPermission(context, "knowledge.read");
        if (denied) return denied;

        const results = await searchKnowledgeBaseService({ organizationId: context.organizationId, query });

        if (results.length === 0) {
          return {
            found: false,
            message:
              "No sufficiently relevant content was found in the knowledge base for this question. Tell the user this information was not found in the available documents — do not guess.",
          };
        }

        return {
          found: true,
          results: results.map((r) => ({
            documentId: r.documentId,
            documentName: r.documentName,
            pageNumber: r.pageNumber,
            content: r.content,
          })),
        };
      },
    }),
  };
}
