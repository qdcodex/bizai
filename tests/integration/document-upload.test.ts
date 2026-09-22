import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestOrganization, makeSession } from "../helpers/db";
import { uploadDocument } from "@/services/document.service";
import { AppError } from "@/lib/errors";
import { MAX_DOCUMENT_SIZE_MB } from "@/ai/rag/config";

describe("uploadDocument validation", () => {
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const org = await createTestOrganization("Upload Validation Org");
    organizationId = org.organizationId;
    userId = org.userId;
  });

  it("accepts a valid TXT file", async () => {
    const session = makeSession(organizationId, userId, "manager");
    const summary = await uploadDocument(session, {
      fileName: "policy.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This is the warranty policy document.", "utf-8"),
    });
    expect(summary.status).toBe("UPLOADED");
    expect(summary.documentType).toBe("txt");
  });

  it("accepts a valid PDF file (magic bytes checked, not just extension)", async () => {
    const session = makeSession(organizationId, userId, "manager");
    const minimalPdf = Buffer.from("%PDF-1.4\n%%EOF");
    const summary = await uploadDocument(session, {
      fileName: "manual.pdf",
      mimeType: "application/pdf",
      buffer: minimalPdf,
    });
    expect(summary.documentType).toBe("pdf");
  });

  it("rejects an unsupported file extension", async () => {
    const session = makeSession(organizationId, userId, "manager");
    await expect(
      uploadDocument(session, {
        fileName: "spreadsheet.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from("irrelevant"),
      }),
    ).rejects.toThrow(AppError);
  });

  it("rejects a file whose declared extension doesn't match its actual content", async () => {
    const session = makeSession(organizationId, userId, "manager");
    // An executable's magic bytes, renamed to look like a PDF.
    const fakePdf = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    await expect(
      uploadDocument(session, { fileName: "not-really.pdf", mimeType: "application/pdf", buffer: fakePdf }),
    ).rejects.toThrow(AppError);
  });

  it("rejects a file larger than the configured maximum size", async () => {
    const session = makeSession(organizationId, userId, "manager");
    const oversized = Buffer.alloc(MAX_DOCUMENT_SIZE_MB * 1024 * 1024 + 1);
    await expect(
      uploadDocument(session, { fileName: "huge.txt", mimeType: "text/plain", buffer: oversized }),
    ).rejects.toThrow(AppError);
  });

  it("rejects an empty file", async () => {
    const session = makeSession(organizationId, userId, "manager");
    await expect(
      uploadDocument(session, { fileName: "empty.txt", mimeType: "text/plain", buffer: Buffer.alloc(0) }),
    ).rejects.toThrow(AppError);
  });

  it("rejects upload from a role without knowledge.create permission", async () => {
    const session = makeSession(organizationId, userId, "staff");
    await expect(
      uploadDocument(session, {
        fileName: "policy.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("content"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
