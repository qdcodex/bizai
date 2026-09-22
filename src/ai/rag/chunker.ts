import { RAG_CHUNK_OVERLAP, RAG_CHUNK_SIZE } from "@/ai/rag/config";

export interface ChunkPageInput {
  pageNumber: number | null;
  text: string;
}

export interface TextChunk {
  content: string;
  pageNumber: number | null;
}

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/;

/**
 * Paragraph-aware recursive chunking: pack whole paragraphs into a chunk up
 * to `chunkSize`; a paragraph that alone exceeds `chunkSize` is split into
 * sentences and re-packed the same way; a single sentence that still
 * exceeds `chunkSize` is hard-split as a last resort. Consecutive chunks
 * within the same page carry a character-overlap tail for context
 * continuity. Overlap is not carried across page boundaries, so every
 * chunk's page number is unambiguous for citations.
 */
export function chunkPages(pages: ChunkPageInput[], options: ChunkOptions = {}): TextChunk[] {
  const chunkSize = options.chunkSize ?? RAG_CHUNK_SIZE;
  const overlap = Math.min(options.overlap ?? RAG_CHUNK_OVERLAP, Math.floor(chunkSize / 2));

  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const paragraphs = splitIntoParagraphs(page.text);
    let buffer = "";

    const flush = () => {
      const trimmed = buffer.trim();
      if (trimmed.length > 0) {
        chunks.push({ content: trimmed, pageNumber: page.pageNumber });
      }
      buffer = "";
    };

    const appendPiece = (piece: string) => {
      const candidate = buffer ? `${buffer}\n\n${piece}` : piece;
      if (candidate.length <= chunkSize || buffer.length === 0) {
        buffer = candidate;
        return;
      }
      // Flush the current buffer, then seed the next one with an overlap tail.
      const tail = overlap > 0 ? buffer.slice(-overlap) : "";
      flush();
      buffer = tail ? `${tail}\n\n${piece}` : piece;
    };

    for (const paragraph of paragraphs) {
      if (paragraph.length <= chunkSize) {
        appendPiece(paragraph);
        continue;
      }
      // Paragraph too large on its own — split into sentences.
      for (const piece of splitOversizedText(paragraph, chunkSize, SENTENCE_SPLIT_RE)) {
        appendPiece(piece);
      }
    }

    flush();
  }

  return chunks;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Splits oversized text on `splitRe`, falling back to a hard character split for pieces still too large. */
function splitOversizedText(text: string, maxSize: number, splitRe: RegExp): string[] {
  const parts = text.split(splitRe).filter(Boolean);
  const result: string[] = [];
  for (const part of parts) {
    if (part.length <= maxSize) {
      result.push(part);
    } else {
      for (let i = 0; i < part.length; i += maxSize) {
        result.push(part.slice(i, i + maxSize));
      }
    }
  }
  return result;
}
