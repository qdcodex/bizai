import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Central RAG configuration — chunking, retrieval, and embedding settings
 * are all here so they can be tuned via env vars without touching pipeline
 * code. These starting values are reasonable defaults, not universally
 * "optimal" — see the evaluation harness (scripts/rag-eval.ts) for tuning.
 */

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const RAG_CHUNK_SIZE = numberEnv("RAG_CHUNK_SIZE", 1000);
export const RAG_CHUNK_OVERLAP = numberEnv("RAG_CHUNK_OVERLAP", 150);
export const RAG_TOP_K = numberEnv("RAG_TOP_K", 5);
/**
 * Tuned against the RAG evaluation harness (scripts/rag-eval.ts) using
 * gemini-embedding-001 truncated to 768 dimensions: genuinely relevant
 * chunks scored 0.61-0.69 cosine similarity, unrelated chunks topped out
 * around 0.56. 0.6 sits in that gap. Re-tune if the embedding model or
 * dimensionality changes.
 */
export const RAG_SIMILARITY_THRESHOLD = numberEnv("RAG_SIMILARITY_THRESHOLD", 0.6);
export const RAG_MAX_CONTEXT_CHARS = numberEnv("RAG_MAX_CONTEXT_CHARS", 12000);
export const MAX_DOCUMENT_SIZE_MB = numberEnv("MAX_DOCUMENT_SIZE_MB", 20);

/**
 * Embedding model + dimensionality. gemini-embedding-001 defaults to 3072
 * dimensions but supports Matryoshka truncation via outputDimensionality;
 * 768 keeps storage/compute reasonable for brute-force (non-Atlas) cosine
 * search while remaining a well-supported, high-quality truncation size.
 */
export const EMBEDDING_MODEL_ID = process.env.RAG_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = numberEnv("RAG_EMBEDDING_DIMENSIONS", 768);

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const embeddingModel = google.embedding(EMBEDDING_MODEL_ID);

const EMBEDDING_PRICING_PER_MILLION_TOKENS: Record<string, number> = {
  "gemini-embedding-001": 0.15,
  "gemini-embedding-2": 0.15,
  "gemini-embedding-2-preview": 0.15,
};

export function estimateEmbeddingCostUsd(model: string, tokens: number): number | null {
  const pricePerMillion = EMBEDDING_PRICING_PER_MILLION_TOKENS[model];
  if (pricePerMillion == null) return null;
  return Math.round(((tokens / 1_000_000) * pricePerMillion) * 1_000_000) / 1_000_000;
}
