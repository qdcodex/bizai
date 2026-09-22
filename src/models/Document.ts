import { Schema, model, models, Types, type Model } from "mongoose";

export const DOCUMENT_STATUSES = ["UPLOADED", "PROCESSING", "READY", "FAILED", "ARCHIVED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const SUPPORTED_DOCUMENT_TYPES = ["pdf", "txt"] as const;
export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number];

/**
 * Metadata only — the actual file bytes live in the configured StorageService,
 * never in MongoDB. `storageKey` is the opaque handle the storage service
 * needs to read/delete the file later.
 */
export interface DocumentRecord {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;

  name: string;
  originalName: string;

  documentType: SupportedDocumentType;
  mimeType: string;
  fileSize: number;

  storageKey: string;
  storageUrl: string | null;

  status: DocumentStatus;

  pageCount: number | null;
  characterCount: number | null;
  chunkCount: number;

  processingError: string | null;

  uploadedBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<DocumentRecord>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },

    documentType: { type: String, enum: SUPPORTED_DOCUMENT_TYPES, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 0 },

    storageKey: { type: String, required: true },
    storageUrl: { type: String, default: null },

    status: { type: String, enum: DOCUMENT_STATUSES, required: true, default: "UPLOADED", index: true },

    pageCount: { type: Number, default: null },
    characterCount: { type: Number, default: null },
    chunkCount: { type: Number, required: true, default: 0 },

    processingError: { type: String, default: null },

    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

documentSchema.index({ organizationId: 1, createdAt: -1 });
documentSchema.index({ organizationId: 1, name: 1 });

export const Document: Model<DocumentRecord> =
  (models.Document as Model<DocumentRecord>) || model<DocumentRecord>("Document", documentSchema);
