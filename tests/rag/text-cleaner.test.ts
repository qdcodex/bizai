import { describe, it, expect } from "vitest";
import { cleanExtractedText, stripRepeatedHeadersFooters } from "@/ai/rag/text-cleaner";

describe("cleanExtractedText", () => {
  it("normalizes CRLF line endings to LF", () => {
    expect(cleanExtractedText("line one\r\nline two\r\n")).toBe("line one\nline two");
  });

  it("collapses runs of spaces and tabs", () => {
    expect(cleanExtractedText("word1    word2\t\tword3")).toBe("word1 word2 word3");
  });

  it("collapses three or more blank lines down to one", () => {
    expect(cleanExtractedText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims leading/trailing whitespace on each line and the whole string", () => {
    expect(cleanExtractedText("  \n  hello  \n  world  \n  ")).toBe("hello\nworld");
  });

  it("preserves meaningful content, including punctuation and single blank lines", () => {
    const input = "Section 1: Warranty.\n\nThis product is covered for 12 months.";
    expect(cleanExtractedText(input)).toBe(input);
  });
});

describe("stripRepeatedHeadersFooters", () => {
  it("removes a header/footer line repeated on more than half the pages", () => {
    const pages = [
      "Acme Corp — Confidential\nIntro content here.\nPage 1 footer",
      "Acme Corp — Confidential\nMore unique content.\nPage 1 footer",
      "Acme Corp — Confidential\nEven more content.\nDifferent footer",
    ];
    const cleaned = stripRepeatedHeadersFooters(pages);
    for (const page of cleaned) {
      expect(page).not.toContain("Acme Corp — Confidential");
    }
    expect(cleaned[0]).toContain("Intro content here.");
    expect(cleaned[2]).toContain("Different footer");
  });

  it("does not strip content that only appears once or twice", () => {
    const pages = [
      "Unique heading A\nBody text A",
      "Unique heading B\nBody text B",
      "Unique heading C\nBody text C",
    ];
    const cleaned = stripRepeatedHeadersFooters(pages);
    expect(cleaned).toEqual(pages);
  });

  it("leaves documents with fewer than 3 pages untouched", () => {
    const pages = ["Repeated Line\nBody one", "Repeated Line\nBody two"];
    expect(stripRepeatedHeadersFooters(pages)).toEqual(pages);
  });
});
