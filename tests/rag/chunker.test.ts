import { describe, it, expect } from "vitest";
import { chunkPages } from "@/ai/rag/chunker";

describe("chunkPages", () => {
  it("packs multiple short paragraphs into a single chunk", () => {
    const chunks = chunkPages(
      [{ pageNumber: 1, text: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph." }],
      { chunkSize: 200, overlap: 0 },
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("First paragraph.");
    expect(chunks[0].content).toContain("Third paragraph.");
  });

  it("starts a new chunk once the size budget is exceeded", () => {
    const a = "A".repeat(60);
    const b = "B".repeat(60);
    const chunks = chunkPages([{ pageNumber: 1, text: `${a}\n\n${b}` }], { chunkSize: 80, overlap: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("hard-splits a single oversized run of text with no sentence boundaries", () => {
    const huge = "x".repeat(500);
    const chunks = chunkPages([{ pageNumber: 1, text: huge }], { chunkSize: 100, overlap: 0 });
    expect(chunks.length).toBe(5);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    }
  });

  it("splits an oversized paragraph on sentence boundaries", () => {
    const paragraph = "One sentence here. Another sentence follows. A third one wraps up the paragraph.";
    const chunks = chunkPages([{ pageNumber: 1, text: paragraph }], { chunkSize: 40, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length > 0)).toBe(true);
  });

  it("never spans a chunk across two pages, keeping page numbers unambiguous", () => {
    const chunks = chunkPages(
      [
        { pageNumber: 1, text: "Page one content that is reasonably short." },
        { pageNumber: 2, text: "Page two content that is also reasonably short." },
      ],
      { chunkSize: 1000, overlap: 50 },
    );
    expect(chunks.every((c) => c.pageNumber === 1 || c.pageNumber === 2)).toBe(true);
    const page1Chunks = chunks.filter((c) => c.pageNumber === 1);
    const page2Chunks = chunks.filter((c) => c.pageNumber === 2);
    expect(page1Chunks.some((c) => c.content.includes("Page two"))).toBe(false);
    expect(page2Chunks.some((c) => c.content.includes("Page one"))).toBe(false);
  });

  it("carries an overlap tail between consecutive chunks on the same page", () => {
    const a = "A".repeat(60);
    const b = "B".repeat(60);
    const chunks = chunkPages([{ pageNumber: 1, text: `${a}\n\n${b}` }], { chunkSize: 80, overlap: 20 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // The second chunk should start with a tail of the first chunk's content.
    expect(chunks[1].content.startsWith(chunks[0].content.slice(-20))).toBe(true);
  });

  it("produces no chunks for empty input", () => {
    expect(chunkPages([{ pageNumber: 1, text: "" }])).toEqual([]);
    expect(chunkPages([])).toEqual([]);
  });
});
