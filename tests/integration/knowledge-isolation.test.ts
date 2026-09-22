import { describe, it, expect, beforeAll } from "vitest";
import { Types } from "mongoose";
import { setupTestDb, createTestOrganization } from "../helpers/db";
import { DocumentChunk } from "@/models/DocumentChunk";
import { vectorSearch } from "@/ai/rag/vector-store";

/**
 * Exercises the real DB query path (bruteForceVectorSearch, since local
 * standalone MongoDB has no Atlas $vectorSearch) with hand-crafted
 * embeddings so no network call to the embedding API is needed. The
 * property under test is org isolation: it must be enforced by the DB
 * query itself, not merely by post-hoc score filtering.
 */
describe("Knowledge base org isolation (vector-store)", () => {
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    await setupTestDb();
    orgAId = (await createTestOrganization("KB Isolation Org A")).organizationId;
    orgBId = (await createTestOrganization("KB Isolation Org B")).organizationId;

    const documentAId = new Types.ObjectId();
    const documentBId = new Types.ObjectId();

    // Identical embeddings across orgs — if isolation relied only on
    // similarity ranking, Org B's chunk would still show up for Org A.
    const sharedEmbedding = [1, 0, 0, 0];

    await DocumentChunk.create([
      {
        organizationId: orgAId,
        documentId: documentAId,
        content: "Org A warranty policy: 12 months from purchase.",
        embedding: sharedEmbedding,
        chunkIndex: 0,
        pageNumber: 1,
        metadata: { documentName: "Org A Warranty Policy" },
      },
      {
        organizationId: orgBId,
        documentId: documentBId,
        content: "Org B warranty policy: 24 months from purchase.",
        embedding: sharedEmbedding,
        chunkIndex: 0,
        pageNumber: 1,
        metadata: { documentName: "Org B Warranty Policy" },
      },
    ]);
  });

  it("only returns the querying organization's chunks, even with identical embeddings", async () => {
    const hitsForA = await vectorSearch({
      organizationId: orgAId,
      queryEmbedding: [1, 0, 0, 0],
      topK: 10,
      similarityThreshold: 0,
    });

    expect(hitsForA.length).toBeGreaterThan(0);
    expect(hitsForA.every((hit) => hit.content.startsWith("Org A"))).toBe(true);
    expect(hitsForA.some((hit) => hit.content.startsWith("Org B"))).toBe(false);
  });

  it("returns nothing for an organization with no chunks", async () => {
    const orgC = await createTestOrganization("KB Isolation Org C");
    const hits = await vectorSearch({
      organizationId: orgC.organizationId,
      queryEmbedding: [1, 0, 0, 0],
      topK: 10,
      similarityThreshold: 0,
    });
    expect(hits).toEqual([]);
  });

  it("filters out results below the similarity threshold", async () => {
    const hits = await vectorSearch({
      organizationId: orgAId,
      queryEmbedding: [0, 1, 0, 0], // orthogonal to the stored embedding — cosine similarity 0
      topK: 10,
      similarityThreshold: 0.5,
    });
    expect(hits).toEqual([]);
  });
});
