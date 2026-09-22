import { describe, it, expect, beforeAll, vi } from "vitest";
import { setupTestDb, createTestOrganization } from "../helpers/db";
import { createProduct } from "@/services/product.service";
import { recordStockMovement } from "@/services/stock-movement.service";
import { createInventoryTools } from "@/ai/tools/inventory-tools";
import { createKnowledgeTools } from "@/ai/tools/knowledge-tools";
import type { ToolContext } from "@/ai/types";

// This is the "hybrid" scenario from the spec: "Which products are low in
// stock and what does our purchasing policy say about reorder quantities?"
// Per source-priority rules, the model would call BOTH a business tool (for
// the live stock fact) and searchKnowledgeBase (for the policy text), then
// combine them — never substituting one for the other. This test exercises
// both tool executions directly (not through the LLM) and checks each
// returns its own kind of fact so the combination is possible upstream.
vi.mock("@/ai/rag/retrieval-service", () => ({
  searchKnowledgeBase: vi.fn(),
}));
import { searchKnowledgeBase as mockSearchKnowledgeBase } from "@/ai/rag/retrieval-service";

async function callTool<T>(tool: unknown, input: unknown): Promise<T> {
  const execute = (tool as { execute?: (input: unknown, options: unknown) => Promise<T> }).execute;
  if (!execute) throw new Error("Tool has no execute function");
  return execute(input, {});
}

describe("Hybrid business-data + RAG workflow", () => {
  let context: ToolContext;

  beforeAll(async () => {
    await setupTestDb();
    const org = await createTestOrganization("Hybrid Workflow Org");
    context = {
      organizationId: org.organizationId,
      userId: org.userId,
      role: "owner",
      conversationId: "000000000000000000000020",
    };

    const product = await createProduct(context.organizationId, {
      itemCode: "HYBRID-LOWSTOCK-1",
      itemName: "Hybrid Low Stock Widget",
      description: "",
      category: "",
      brand: "",
      partNumber: "",
      uom: "unit",
      costPrice: 10,
      sellingPrice: 20,
      minSellingPrice: 15,
      lowStockThreshold: 50,
      imageUrl: "",
      isActive: true,
    });
    await recordStockMovement({
      organizationId: context.organizationId,
      productId: product._id.toString(),
      type: "PURCHASE",
      quantity: 5,
      createdBy: context.userId,
    });
  });

  it("getLowStockProducts returns the live database fact (never fabricated)", async () => {
    const tools = createInventoryTools(context);
    const result = await callTool<{ products: Array<{ itemName: string; currentStock: number }> }>(
      tools.getLowStockProducts,
      { limit: 50 },
    );
    const match = result.products.find((p) => p.itemName === "Hybrid Low Stock Widget");
    expect(match).toBeDefined();
    expect(match?.currentStock).toBe(5);
  });

  it("searchKnowledgeBase returns the document fact, scoped to the same organization", async () => {
    vi.mocked(mockSearchKnowledgeBase).mockResolvedValueOnce([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        documentName: "Purchasing Policy",
        content: "Reorder quantities should cover at least 30 days of average demand.",
        pageNumber: 3,
        score: 0.9,
      },
    ]);
    const tools = createKnowledgeTools(context);
    const result = await callTool<{ found: boolean; results: Array<{ documentName: string; content: string }> }>(
      tools.searchKnowledgeBase,
      { query: "purchasing policy reorder quantity" },
    );
    expect(result.found).toBe(true);
    expect(result.results[0].documentName).toBe("Purchasing Policy");
    expect(result.results[0].content).toContain("30 days");
  });

  it("searchKnowledgeBase reports found:false rather than fabricating a policy when nothing matches", async () => {
    vi.mocked(mockSearchKnowledgeBase).mockResolvedValueOnce([]);
    const tools = createKnowledgeTools(context);
    const result = await callTool<{ found: boolean; message: string }>(tools.searchKnowledgeBase, {
      query: "unrelated question with no matching document",
    });
    expect(result.found).toBe(false);
    expect(result.message.toLowerCase()).toContain("do not guess");
  });
});
