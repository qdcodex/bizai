import { RAG_SIMILARITY_THRESHOLD, RAG_TOP_K } from "@/ai/rag/config";
import { embedQuery } from "@/ai/rag/embedding-service";
import { vectorSearch, type VectorSearchHit } from "@/ai/rag/vector-store";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number | null;
  score: number;
}

export interface RetrievalOptions {
  organizationId: string;
  query: string;
  documentId?: string;
  topK?: number;
  similarityThreshold?: number;
}

/**
 * Question → embedding → vector search → ranked, organization-scoped chunks.
 * This is the query-time half of the RAG pipeline (see embedding-service for
 * the ingestion-time half) — embeddings are never regenerated per question,
 * only the question itself is embedded here.
 */
export async function searchKnowledgeBase(options: RetrievalOptions): Promise<RetrievedChunk[]> {
  const { embedding } = await embedQuery(options.query);

  const topK = options.topK ?? RAG_TOP_K;

  // Over-fetch a bit so the per-document cap below still has room to pick
  // the best `topK` overall once near-duplicates from one document are capped.
  const hits = await vectorSearch({
    organizationId: options.organizationId,
    documentId: options.documentId,
    queryEmbedding: embedding,
    topK: topK * 3,
    similarityThreshold: options.similarityThreshold ?? RAG_SIMILARITY_THRESHOLD,
  });

  const diverseHits = capPerDocument(hits, 3).slice(0, topK);

  return diverseHits.map((hit) => ({
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    documentName: hit.metadata.documentName ?? "Untitled document",
    content: hit.content,
    pageNumber: hit.pageNumber,
    score: hit.score,
  }));
}

/** Keeps hits sorted by score but limits how many can come from the same document, for source diversity. */
function capPerDocument(hits: VectorSearchHit[], maxPerDocument: number): VectorSearchHit[] {
  const counts = new Map<string, number>();
  const result: VectorSearchHit[] = [];

  for (const hit of hits) {
    const count = counts.get(hit.documentId) ?? 0;
    if (count >= maxPerDocument) continue;
    counts.set(hit.documentId, count + 1);
    result.push(hit);
  }

  return result;
}
