import path from "node:path";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Document, type DocumentRecord, type SupportedDocumentType } from "@/models/Document";
import { DocumentChunk } from "@/models/DocumentChunk";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { storageService } from "@/lib/storage";
import { buildPagination, type PaginatedResult } from "@/lib/validation/pagination";
import { MAX_DOCUMENT_SIZE_MB } from "@/ai/rag/config";
import { extractDocumentText } from "@/ai/rag/extraction-service";
import { cleanExtractedText, stripRepeatedHeadersFooters } from "@/ai/rag/text-cleaner";
import { chunkPages } from "@/ai/rag/chunker";
import { embedDocumentChunks, EMBEDDING_MODEL_ID } from "@/ai/rag/embedding-service";
import { recordEmbeddingUsage } from "@/ai/services/usage-service";

const EXTENSION_TO_TYPE: Record<string, SupportedDocumentType> = {
  ".pdf": "pdf",
  ".txt": "txt",
};

const ALLOWED_MIME_TYPES: Record<SupportedDocumentType, string[]> = {
  pdf: ["application/pdf"],
  txt: ["text/plain"],
};

function detectDocumentType(fileName: string, mimeType: string): SupportedDocumentType {
  const ext = path.extname(fileName).toLowerCase();
  const type = EXTENSION_TO_TYPE[ext];
  if (!type) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Unsupported file type "${ext || "unknown"}". Only PDF and TXT files are supported.`,
      400,
    );
  }
  // Don't trust the extension alone — cross-check the browser-reported MIME type too.
  if (mimeType && !ALLOWED_MIME_TYPES[type].includes(mimeType)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `The file's content type ("${mimeType}") doesn't match its extension.`,
      400,
    );
  }
  return type;
}

/** Basic magic-byte / heuristic check so a renamed executable can't slip in as ".pdf"/".txt". */
function assertLooksLikeDeclaredType(buffer: Buffer, type: SupportedDocumentType): void {
  if (type === "pdf") {
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new AppError("VALIDATION_ERROR", "This file does not look like a valid PDF.", 400);
    }
    return;
  }

  // txt: reject anything that looks like a binary/executable (NUL bytes, or a
  // Windows/ELF executable header) rather than plain text.
  const sample = buffer.subarray(0, 1024);
  if (sample.includes(0)) {
    throw new AppError("VALIDATION_ERROR", "This file does not look like a plain text file.", 400);
  }
  const magic = sample.subarray(0, 2).toString("ascii");
  if (magic === "MZ" || sample.subarray(0, 4).toString("hex") === "7f454c46") {
    throw new AppError("VALIDATION_ERROR", "This file does not look like a plain text file.", 400);
  }
}

export interface UploadDocumentInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface DocumentSummary {
  id: string;
  name: string;
  originalName: string;
  documentType: SupportedDocumentType;
  fileSize: number;
  status: DocumentRecord["status"];
  pageCount: number | null;
  chunkCount: number;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
}

function toSummary(doc: DocumentRecord): DocumentSummary {
  return {
    id: doc._id.toString(),
    name: doc.name,
    originalName: doc.originalName,
    documentType: doc.documentType,
    fileSize: doc.fileSize,
    status: doc.status,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    processingError: doc.processingError,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Validates and stores an uploaded file, creating the Document record with
 * status UPLOADED. Does NOT run the extraction/chunking/embedding pipeline —
 * call `processDocument` for that (kept separate so it can move to a
 * background worker later without touching this upload path).
 */
export async function uploadDocument(
  session: SessionPayload,
  input: UploadDocumentInput,
): Promise<DocumentSummary> {
  requirePermission(session, "knowledge.create");
  await connectToDatabase();

  const maxBytes = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;
  if (input.buffer.byteLength === 0) {
    throw new AppError("VALIDATION_ERROR", "The uploaded file is empty.", 400);
  }
  if (input.buffer.byteLength > maxBytes) {
    throw new AppError(
      "VALIDATION_ERROR",
      `File is too large. Maximum size is ${MAX_DOCUMENT_SIZE_MB} MB.`,
      400,
    );
  }

  const documentType = detectDocumentType(input.fileName, input.mimeType);
  assertLooksLikeDeclaredType(input.buffer, documentType);

  const documentId = new Types.ObjectId();
  const { storageKey, storageUrl } = await storageService.save({
    organizationId: session.organizationId,
    documentId: documentId.toString(),
    fileName: input.fileName,
    buffer: input.buffer,
  });

  const doc = await Document.create({
    _id: documentId,
    organizationId: session.organizationId,
    name: path.basename(input.fileName, path.extname(input.fileName)),
    originalName: input.fileName,
    documentType,
    mimeType: input.mimeType,
    fileSize: input.buffer.byteLength,
    storageKey,
    storageUrl,
    status: "UPLOADED",
    uploadedBy: session.userId,
  });

  return toSummary(doc);
}

/**
 * Runs the ingestion pipeline for a document already saved to storage:
 * extract → clean → chunk → embed → store chunks → status READY. Any
 * failure moves the document to FAILED with a recoverable error message,
 * rather than leaving it stuck in PROCESSING forever.
 */
export async function processDocument(documentId: string): Promise<void> {
  await connectToDatabase();

  const doc = await Document.findById(documentId);
  if (!doc) return;

  doc.status = "PROCESSING";
  doc.processingError = null;
  await doc.save();

  try {
    const fileBuffer = await storageService.read(doc.storageKey);
    const extraction = await extractDocumentText(fileBuffer, doc.documentType);

    const pages = extraction.pages
      ? stripRepeatedHeadersFooters(extraction.pages.map((p) => p.text)).map((text, i) => ({
          pageNumber: extraction.pages![i].pageNumber,
          text: cleanExtractedText(text),
        }))
      : [{ pageNumber: null, text: cleanExtractedText(extraction.text) }];

    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new AppError("VALIDATION_ERROR", "No extractable text was found in this document.", 400);
    }

    const startedAt = Date.now();
    const { embeddings, totalTokens } = await embedDocumentChunks(chunks.map((c) => c.content));

    await DocumentChunk.deleteMany({ documentId: doc._id });
    await DocumentChunk.insertMany(
      chunks.map((chunk, index) => ({
        organizationId: doc.organizationId,
        documentId: doc._id,
        content: chunk.content,
        embedding: embeddings[index],
        chunkIndex: index,
        pageNumber: chunk.pageNumber,
        metadata: { documentName: doc.originalName },
      })),
    );

    await recordEmbeddingUsage({
      organizationId: doc.organizationId.toString(),
      userId: doc.uploadedBy.toString(),
      documentId: doc._id.toString(),
      model: EMBEDDING_MODEL_ID,
      tokens: totalTokens,
      durationMs: Date.now() - startedAt,
    });

    doc.characterCount = extraction.text.length;
    doc.pageCount = extraction.pageCount;
    doc.chunkCount = chunks.length;
    doc.status = "READY";
    doc.processingError = null;
    await doc.save();
  } catch (error) {
    doc.status = "FAILED";
    doc.processingError = error instanceof Error ? error.message : "Unknown processing error.";
    await doc.save();
  }
}

export interface DocumentQueryInput {
  page: number;
  limit: number;
  search?: string;
  status?: DocumentRecord["status"];
  documentType?: SupportedDocumentType;
}

export async function listDocuments(
  session: SessionPayload,
  query: DocumentQueryInput,
): Promise<PaginatedResult<DocumentSummary>> {
  requirePermission(session, "knowledge.read");
  await connectToDatabase();

  const filter: Record<string, unknown> = {
    organizationId: session.organizationId,
    status: { $ne: "ARCHIVED" },
  };
  if (query.status) filter.status = query.status;
  if (query.documentType) filter.documentType = query.documentType;
  if (query.search) filter.name = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const skip = (query.page - 1) * query.limit;
  const [docs, total] = await Promise.all([
    Document.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    Document.countDocuments(filter),
  ]);

  return { data: docs.map(toSummary), pagination: buildPagination(query.page, query.limit, total) };
}

export async function getDocument(session: SessionPayload, documentId: string): Promise<DocumentSummary> {
  requirePermission(session, "knowledge.read");
  await connectToDatabase();

  const doc = await Document.findOne({ _id: documentId, organizationId: session.organizationId });
  if (!doc) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }
  return toSummary(doc);
}

/**
 * Marks a document for reprocessing and returns immediately; the caller is
 * expected to schedule `processDocument(documentId)` to run after the
 * response is sent (e.g. via `after()`), the same way the initial upload
 * does. `processDocument` itself replaces old chunks atomically-per-document
 * (delete then insert) so reprocessing never leaves duplicate chunks behind.
 */
export async function markDocumentForReprocessing(
  session: SessionPayload,
  documentId: string,
): Promise<DocumentSummary> {
  requirePermission(session, "knowledge.create");
  await connectToDatabase();

  const doc = await Document.findOne({ _id: documentId, organizationId: session.organizationId });
  if (!doc) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }

  doc.status = "PROCESSING";
  doc.processingError = null;
  await doc.save();

  return toSummary(doc);
}

export async function archiveDocument(session: SessionPayload, documentId: string): Promise<DocumentSummary> {
  requirePermission(session, "knowledge.delete");
  await connectToDatabase();

  const doc = await Document.findOneAndUpdate(
    { _id: documentId, organizationId: session.organizationId },
    { $set: { status: "ARCHIVED" } },
    { new: true },
  );
  if (!doc) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }
  return toSummary(doc);
}

/**
 * Deletes chunks, the stored file, and the document metadata, in that order.
 * If file deletion fails partway through, the document is left in a clearly
 * recoverable state (chunks already gone, metadata intact) rather than
 * silently reporting success — the caller sees the real error and can retry.
 */
export async function deleteDocument(session: SessionPayload, documentId: string): Promise<void> {
  requirePermission(session, "knowledge.delete");
  await connectToDatabase();

  const doc = await Document.findOne({ _id: documentId, organizationId: session.organizationId });
  if (!doc) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }

  await DocumentChunk.deleteMany({ documentId: doc._id, organizationId: session.organizationId });

  try {
    await storageService.delete(doc.storageKey);
  } catch (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Document chunks were removed, but the stored file could not be deleted: ${
        error instanceof Error ? error.message : "unknown error"
      }. Please try deleting again.`,
      500,
    );
  }

  await doc.deleteOne();
}
