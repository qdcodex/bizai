import { embed, embedMany } from "ai";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID, embeddingModel } from "@/ai/rag/config";

const BATCH_SIZE = 20;

/**
 * The Google provider reports embedding token usage as `NaN` (not
 * `undefined`) when it doesn't return a usable count, which `?? 0` alone
 * does not catch — `NaN ?? 0` is still `NaN`. Coerce explicitly instead.
 */
function safeTokenCount(tokens: number | null | undefined): number {
  return typeof tokens === "number" && Number.isFinite(tokens) ? tokens : 0;
}

export interface EmbedBatchResult {
  embeddings: number[][];
  totalTokens: number;
}

/**
 * Embeds many chunks at once for ingestion, batching requests so a large
 * document doesn't send one call per chunk. Uses taskType "RETRIEVAL_DOCUMENT"
 * — Google recommends distinguishing document vs. query embeddings for
 * meaningfully better retrieval quality with gemini-embedding models.
 */
export async function embedDocumentChunks(texts: string[]): Promise<EmbedBatchResult> {
  const embeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await embedMany({
      model: embeddingModel,
      values: batch,
      maxParallelCalls: 2,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      },
    });
    embeddings.push(...result.embeddings);
    totalTokens += safeTokenCount(result.usage?.tokens);
  }

  return { embeddings, totalTokens };
}

export interface EmbedQueryResult {
  embedding: number[];
  tokens: number;
}

/** Embeds a single user query at search time, using taskType "RETRIEVAL_QUERY". */
export async function embedQuery(text: string): Promise<EmbedQueryResult> {
  const result = await embed({
    model: embeddingModel,
    value: text,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_QUERY",
      },
    },
  });
  return { embedding: result.embedding, tokens: safeTokenCount(result.usage?.tokens) };
}

export { EMBEDDING_MODEL_ID, EMBEDDING_DIMENSIONS };
