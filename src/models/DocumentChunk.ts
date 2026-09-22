import { Schema, model, models, Types, type Model } from "mongoose";

export interface DocumentChunkMetadata {
  documentName: string;
  section?: string;
  [key: string]: unknown;
}

export interface DocumentChunkRecord {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  documentId: Types.ObjectId;

  content: string;
  embedding: number[];

  chunkIndex: number;
  pageNumber: number | null;

  metadata: DocumentChunkMetadata;

  createdAt: Date;
}

const documentChunkSchema = new Schema<DocumentChunkRecord>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },

    content: { type: String, required: true },
    embedding: { type: [Number], required: true },

    chunkIndex: { type: Number, required: true },
    pageNumber: { type: Number, default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

documentChunkSchema.index({ organizationId: 1, documentId: 1, chunkIndex: 1 });

export const DocumentChunk: Model<DocumentChunkRecord> =
  (models.DocumentChunk as Model<DocumentChunkRecord>) ||
  model<DocumentChunkRecord>("DocumentChunk", documentChunkSchema);
