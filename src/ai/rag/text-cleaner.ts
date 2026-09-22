/**
 * Light-touch cleaning of extracted text. Deliberately conservative — the
 * goal is to make chunking reliable, not to rewrite the document. Never
 * removes content that carries meaning.
 */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n") // normalize line endings
    .replace(/[ \t]+/g, " ") // collapse runs of spaces/tabs
    .replace(/ *\n */g, "\n") // trim spaces around line breaks
    .replace(/\n{3,}/g, "\n\n") // collapse 3+ blank lines to one
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Removes a line that repeats identically on most pages (a common running
 * header/footer, e.g. "Acme Corp — Confidential") without touching content
 * that only appears once or twice. Conservative: only strips lines seen on
 * more than half the pages, and only from the top/bottom couple of lines.
 */
export function stripRepeatedHeadersFooters(pages: string[]): string[] {
  if (pages.length < 3) return pages;

  const edgeLineCounts = new Map<string, number>();
  const EDGE_LINES = 2;

  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim());
    const candidates = new Set([...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)]);
    for (const line of candidates) {
      if (!line) continue;
      edgeLineCounts.set(line, (edgeLineCounts.get(line) ?? 0) + 1);
    }
  }

  const threshold = pages.length * 0.5;
  const repeated = new Set(
    [...edgeLineCounts.entries()].filter(([, count]) => count > threshold).map(([line]) => line),
  );
  if (repeated.size === 0) return pages;

  return pages.map((page) => {
    const lines = page.split("\n");
    const filtered = lines.filter((line, index) => {
      const isEdge = index < EDGE_LINES || index >= lines.length - EDGE_LINES;
      return !(isEdge && repeated.has(line.trim()));
    });
    return filtered.join("\n");
  });
}
