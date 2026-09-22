import { generateText } from "ai";
import { aiModels } from "@/ai/models/config";
import { buildRagPrompt } from "@/ai/prompts/rag";
import { searchKnowledgeBase, type RetrievedChunk } from "@/ai/rag/retrieval-service";
import { buildContext } from "@/ai/rag/context-builder";

export interface RagSource {
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  chunkId: string;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
  /** True when nothing sufficiently relevant was retrieved — the answer is a "not found" response, not a guess. */
  noAnswer: boolean;
}

/**
 * Standalone question → grounded answer pipeline, independent of the chat
 * UI. Used by the RAG evaluation harness and available for any future
 * non-chat surface (e.g. a "quick answer" box on the Knowledge Base page).
 * The AI Assistant itself uses `searchKnowledgeBase` as a tool instead, so
 * retrieval results flow into the same conversation as business-data tools.
 */
export async function answer(organizationId: string, question: string): Promise<RagAnswer> {
  const chunks: RetrievedChunk[] = await searchKnowledgeBase({ organizationId, query: question });

  if (chunks.length === 0) {
    return {
      answer: "I couldn't find enough information about that in your knowledge base.",
      sources: [],
      noAnswer: true,
    };
  }

  const { context, usedChunks } = buildContext(chunks);

  const result = await generateText({
    model: aiModels.assistant,
    prompt: buildRagPrompt(question, context),
  });

  return {
    answer: result.text,
    sources: usedChunks.map((chunk) => ({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber,
      chunkId: chunk.chunkId,
    })),
    noAnswer: false,
  };
}
