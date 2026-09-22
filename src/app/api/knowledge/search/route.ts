import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { knowledgeSearchQuerySchema } from "@/lib/validation/document";
import { searchKnowledgeBase } from "@/ai/rag/retrieval-service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";

/** Backs the Knowledge Base page's own search box (distinct from the AI Assistant's searchKnowledgeBase tool). */
export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "knowledge.read");
    const query = knowledgeSearchQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return searchKnowledgeBase({ organizationId: session.organizationId, query: query.q, topK: query.limit });
  });
}
