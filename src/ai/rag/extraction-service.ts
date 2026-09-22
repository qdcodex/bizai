import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "@/lib/errors";
import type { SupportedDocumentType } from "@/models/Document";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  text: string;
  pageCount: number | null;
  pages: ExtractedPage[] | null;
}

/**
 * Extracts raw text (and per-page text, where the format has pages) from an
 * uploaded file buffer. Runs entirely server-side — never in the browser.
 * Designed so DOCX/CSV/XLSX support can be added later as new branches here
 * without touching the chunking/embedding pipeline downstream.
 */
export async function extractDocumentText(
  buffer: Buffer,
  documentType: SupportedDocumentType,
): Promise<ExtractionResult> {
  switch (documentType) {
    case "pdf":
      return extractPdfText(buffer);
    case "txt":
      return extractTxtText(buffer);
    default:
      throw new AppError("VALIDATION_ERROR", `Unsupported document type: ${documentType}`, 400);
  }
}

async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: pageTexts, totalPages } = await extractText(pdf, { mergePages: false });

    const pages: ExtractedPage[] = pageTexts.map((text, index) => ({
      pageNumber: index + 1,
      text,
    }));

    return {
      text: pageTexts.join("\n\n"),
      pageCount: totalPages,
      pages,
    };
  } catch (error) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Could not extract text from this PDF: ${error instanceof Error ? error.message : "unknown error"}`,
      400,
    );
  }
}

function extractTxtText(buffer: Buffer): ExtractionResult {
  const text = buffer.toString("utf-8");
  return { text, pageCount: null, pages: null };
}
