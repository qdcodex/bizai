import { Types } from "mongoose";
import { cosineSimilarity } from "ai";
import { connectToDatabase } from "@/lib/db/connect";
import { DocumentChunk, type DocumentChunkMetadata } from "@/models/DocumentChunk";

/**
 * Matches the index defined in scripts/atlas-vector-index.json — create
 * that index on the `documentchunks` collection when this app is deployed
 * against MongoDB Atlas. On the local standalone MongoDB used in dev, this
 * index does not exist and isAtlasVectorSearchSupported() below falls back
 * to bruteForceVectorSearch automatically; no code changes are needed when
 * moving between the two.
 */
export const VECTOR_INDEX_NAME = "document_chunk_vector_index";

export interface VectorSearchParams {
  organizationId: string;
  documentId?: string;
  queryEmbedding: number[];
  topK: number;
  similarityThreshold: number;
}

export interface VectorSearchHit {
  chunkId: string;
  documentId: string;
  content: string;
  pageNumber: number | null;
  metadata: DocumentChunkMetadata;
  score: number;
}

/**
 * Safety cap on how many of an organization's chunks are pulled into memory
 * for brute-force cosine ranking (the non-Atlas fallback). Fine for the
 * realistic scale of an SMB knowledge base; a genuinely huge corpus should
 * run on MongoDB Atlas, where `$vectorSearch` does this server-side instead.
 */
const BRUTE_FORCE_SCAN_LIMIT = 5000;

/**
 * `null` = not yet checked, `true`/`false` = cached result for this process.
 * Detected once by probing the actual aggregation stage rather than trusting
 * a config flag, so the right path is used automatically in dev (standalone
 * MongoDB) vs. production (MongoDB Atlas) without any manual switch.
 */
let atlasVectorSearchSupported: boolean | null = null;

async function isAtlasVectorSearchSupported(): Promise<boolean> {
  if (atlasVectorSearchSupported !== null) return atlasVectorSearchSupported;

  try {
    await DocumentChunk.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector: new Array(8).fill(0),
          numCandidates: 1,
          limit: 1,
        },
      },
      { $limit: 0 },
    ]);
    atlasVectorSearchSupported = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // "Unrecognized pipeline stage" / unknown-command style errors mean this
    // deployment has no Atlas Search at all (e.g. local/standalone MongoDB).
    // Any other error (wrong dimensions, index not found, etc.) means the
    // stage *is* supported — it just isn't configured correctly yet.
    const stageUnsupported = /unrecognized pipeline stage|no such (command|stage)/i.test(message);
    atlasVectorSearchSupported = false;
    if (stageUnsupported) {
      console.warn(
        "[rag] MongoDB Atlas Vector Search is not available on this deployment; using in-memory cosine similarity instead.",
      );
    } else {
      console.warn(
        `[rag] $vectorSearch is supported but failed (likely missing index "${VECTOR_INDEX_NAME}"): ${message}. Falling back to in-memory cosine similarity until the index is created.`,
      );
    }
  }

  return atlasVectorSearchSupported;
}

export async function vectorSearch(params: VectorSearchParams): Promise<VectorSearchHit[]> {
  await connectToDatabase();

  if (await isAtlasVectorSearchSupported()) {
    try {
      return await atlasVectorSearch(params);
    } catch (error) {
      console.error("[rag] Atlas vector search failed, falling back to in-memory search:", error);
    }
  }

  return bruteForceVectorSearch(params);
}

async function atlasVectorSearch(params: VectorSearchParams): Promise<VectorSearchHit[]> {
  const filter: Record<string, unknown> = {
    organizationId: { $eq: new Types.ObjectId(params.organizationId) },
  };
  if (params.documentId) {
    filter.documentId = { $eq: new Types.ObjectId(params.documentId) };
  }

  const rows = await DocumentChunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: params.queryEmbedding,
        numCandidates: Math.max(params.topK * 20, 100),
        limit: params.topK,
        filter,
      },
    },
    {
      $project: {
        content: 1,
        documentId: 1,
        pageNumber: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return rows
    .filter((row) => row.score >= params.similarityThreshold)
    .map((row) => ({
      chunkId: String(row._id),
      documentId: String(row.documentId),
      content: row.content,
      pageNumber: row.pageNumber ?? null,
      metadata: row.metadata ?? {},
      score: row.score,
    }));
}

/**
 * Fallback for deployments without Atlas Search: narrows by organization
 * (and optionally document) first via a normal indexed query, then ranks
 * the candidates in application code. Organization scoping happens in the
 * MongoDB query itself, not just in the ranking step — a chunk from another
 * organization is never even fetched, let alone scored.
 */
async function bruteForceVectorSearch(params: VectorSearchParams): Promise<VectorSearchHit[]> {
  const filter: Record<string, unknown> = { organizationId: params.organizationId };
  if (params.documentId) filter.documentId = params.documentId;

  const candidates = await DocumentChunk.find(filter)
    .select("content documentId pageNumber metadata embedding")
    .limit(BRUTE_FORCE_SCAN_LIMIT)
    .lean();

  const scored = candidates.map((chunk) => ({
    chunkId: String(chunk._id),
    documentId: String(chunk.documentId),
    content: chunk.content,
    pageNumber: chunk.pageNumber ?? null,
    metadata: (chunk.metadata as DocumentChunkMetadata) ?? {},
    score: cosineSimilarity(params.queryEmbedding, chunk.embedding),
  }));

  return scored
    .filter((hit) => hit.score >= params.similarityThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, params.topK);
}
