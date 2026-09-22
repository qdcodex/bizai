import { Schema, model, models, Types, type Model } from "mongoose";

export const AI_USAGE_KINDS = ["chat", "embedding"] as const;
export type AIUsageKind = (typeof AI_USAGE_KINDS)[number];

export interface AIUsageDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Present for chat usage; absent for embedding usage generated during document ingestion. */
  conversationId: Types.ObjectId | null;
  /** Present for embedding usage generated during document ingestion. */
  documentId: Types.ObjectId | null;
  kind: AIUsageKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
  durationMs: number;
  /** Present for chat usage — how many tool-calling steps the turn took. */
  toolStepCount: number | null;
  /** Present for chat usage — how many of those steps called searchKnowledgeBase. */
  ragRetrievalCount: number | null;
  createdAt: Date;
}

const aiUsageSchema = new Schema<AIUsageDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", default: null },
    kind: { type: String, enum: AI_USAGE_KINDS, required: true, default: "chat" },
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true, default: 0 },
    outputTokens: { type: Number, required: true, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    estimatedCostUsd: { type: Number, default: null },
    durationMs: { type: Number, required: true, default: 0 },
    toolStepCount: { type: Number, default: null },
    ragRetrievalCount: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiUsageSchema.index({ organizationId: 1, createdAt: -1 });
aiUsageSchema.index({ organizationId: 1, kind: 1, createdAt: -1 });

export const AIUsage: Model<AIUsageDocument> =
  (models.AIUsage as Model<AIUsageDocument>) || model<AIUsageDocument>("AIUsage", aiUsageSchema);
