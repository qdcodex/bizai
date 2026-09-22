import { Schema, model, models, Types, type Model } from "mongoose";

export const PENDING_ACTION_STATUSES = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type PendingActionStatus = (typeof PENDING_ACTION_STATUSES)[number];

/** Extensibility point for confirmable write actions. */
export const ACTION_TYPES = ["CREATE_QUOTATION", "ADJUST_STOCK"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/**
 * A server-persisted record of an AI-proposed write action awaiting user
 * confirmation. The LLM never writes to business collections directly — a
 * tool's `execute` only ever produces one of these plus a preview; the actual
 * business-service call happens exclusively from the confirm endpoint, after
 * re-validating permission, ownership, expiry, and status atomically.
 */
export interface PendingActionRecord {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;

  actionType: ActionType;
  toolName: string;
  requiredPermission: string;

  /** The tool-call arguments, already validated against the tool's zod schema. */
  validatedArguments: Record<string, unknown>;
  /** Friendly, fully-priced/resolved preview shown to the user before confirming. */
  preview: Record<string, unknown>;

  status: PendingActionStatus;
  resultSummary: string | null;
  resultData: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  confirmedAt: Date | null;
  executedAt: Date | null;
}

const pendingActionSchema = new Schema<PendingActionRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },

    actionType: { type: String, enum: ACTION_TYPES, required: true },
    toolName: { type: String, required: true },
    requiredPermission: { type: String, required: true },

    validatedArguments: { type: Schema.Types.Mixed, required: true },
    preview: { type: Schema.Types.Mixed, required: true },

    status: {
      type: String,
      enum: PENDING_ACTION_STATUSES,
      required: true,
      default: "PENDING_CONFIRMATION",
      index: true,
    },
    resultSummary: { type: String, default: null },
    resultData: { type: Schema.Types.Mixed, default: null },

    expiresAt: { type: Date, required: true },
    confirmedAt: { type: Date, default: null },
    executedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

pendingActionSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const PendingAction: Model<PendingActionRecord> =
  (models.PendingAction as Model<PendingActionRecord>) ||
  model<PendingActionRecord>("PendingAction", pendingActionSchema);
