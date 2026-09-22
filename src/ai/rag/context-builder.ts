import { RAG_MAX_CONTEXT_CHARS } from "@/ai/rag/config";
import type { RetrievedChunk } from "@/ai/rag/retrieval-service";

export interface BuiltContext {
  /** Formatted text ready to insert into the LLM prompt. Empty string if no chunks were retrieved. */
  context: string;
  /** The chunks actually included after the character budget was applied (may be fewer than passed in). */
  usedChunks: RetrievedChunk[];
}

/**
 * Formats retrieved chunks into a labeled context block the model can cite
 * back ("[Source 1]" → "Warranty Policy.pdf — Page 4"), and enforces a
 * total character budget so a handful of long chunks can't blow out the
 * model's context window.
 */
export function buildContext(chunks: RetrievedChunk[], maxChars = RAG_MAX_CONTEXT_CHARS): BuiltContext {
  const usedChunks: RetrievedChunk[] = [];
  const blocks: string[] = [];
  let totalChars = 0;

  for (const chunk of chunks) {
    const label = chunk.pageNumber != null ? `${chunk.documentName} — Page ${chunk.pageNumber}` : chunk.documentName;
    const block = `[Source ${usedChunks.length + 1}]\nDocument: ${label}\n\n${chunk.content}`;

    if (totalChars + block.length > maxChars && usedChunks.length > 0) break;

    blocks.push(block);
    usedChunks.push(chunk);
    totalChars += block.length;
  }

  return { context: blocks.join("\n\n---\n\n"), usedChunks };
}
