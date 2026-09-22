import { describe, it, expect, vi } from "vitest";
import { createKnowledgeTools } from "@/ai/tools/knowledge-tools";
import type { ToolContext } from "@/ai/types";

// The retrieval service itself (embeddings + real DB vector search) is
// covered by tests/integration/knowledge-isolation.test.ts; this test is
// only concerned with the tool's own behavior — permission gating and the
// found:true/found:false response shape the model relies on.
vi.mock("@/ai/rag/retrieval-service", () => ({
  searchKnowledgeBase: vi.fn(),
}));

import { searchKnowledgeBase as mockSearchKnowledgeBase } from "@/ai/rag/retrieval-service";

async function callTool<T>(tool: unknown, input: unknown): Promise<T> {
  const execute = (tool as { execute?: (input: unknown, options: unknown) => Promise<T> }).execute;
  if (!execute) throw new Error("Tool has no execute function");
  return execute(input, {});
}

describe("searchKnowledgeBase AI tool", () => {
  const context: ToolContext = {
    organizationId: "org-1",
    userId: "user-1",
    role: "viewer",
    conversationId: "000000000000000000000003",
  };

  it("is available to the viewer role (knowledge.read is the lowest tier)", () => {
    const tools = createKnowledgeTools(context);
    expect(tools.searchKnowledgeBase).toBeDefined();
  });

  it("returns found:false with a 'do not guess' instruction when nothing relevant is found", async () => {
    vi.mocked(mockSearchKnowledgeBase).mockResolvedValueOnce([]);
    const tools = createKnowledgeTools(context);
    const result = await callTool<{ found: boolean; message: string }>(tools.searchKnowledgeBase, {
      query: "What is the refund policy?",
    });
    expect(result.found).toBe(false);
    expect(result.message.toLowerCase()).toContain("do not guess");
  });

  it("returns found:true with citation data when results exist", async () => {
    vi.mocked(mockSearchKnowledgeBase).mockResolvedValueOnce([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentName: "Warranty Policy",
        content: "Products are covered for 12 months from the date of purchase.",
        pageNumber: 2,
        score: 0.91,
      },
    ]);
    const tools = createKnowledgeTools(context);
    const result = await callTool<{
      found: boolean;
      results: Array<{ documentName: string; pageNumber: number | null }>;
    }>(tools.searchKnowledgeBase, { query: "warranty period" });

    expect(result.found).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].documentName).toBe("Warranty Policy");
    expect(result.results[0].pageNumber).toBe(2);
  });
});
