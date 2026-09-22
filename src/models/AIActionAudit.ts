import { Schema, model, models, Types, type Model } from "mongoose";
import { ACTION_TYPES, PENDING_ACTION_STATUSES, type ActionType, type PendingActionStatus } from "@/models/PendingAction";

/**
 * Durable audit trail for AI-proposed business actions — written once per
 * pending action, at the moment it reaches a terminal state (COMPLETED,
 * FAILED, or CANCELLED). Distinct from AIToolExecution (which logs every
 * tool call, read or write): this is specifically the trail a business owner
 * would want for "what did the AI do to my data, and who confirmed it."
 */
export interface AIActionAuditRecord {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  actionId: Types.ObjectId;

  actionType: ActionType;
  toolName: string;
  status: PendingActionStatus;

  sanitizedArguments: Record<string, unknown>;
  resultSummary: string;

  createdAt: Date;
  confirmedAt: Date | null;
  executedAt: Date | null;
}

const aiActionAuditSchema = new Schema<AIActionAuditRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    actionId: { type: Schema.Types.ObjectId, ref: "PendingAction", required: true },

    actionType: { type: String, enum: ACTION_TYPES, required: true },
    toolName: { type: String, required: true },
    status: { type: String, enum: PENDING_ACTION_STATUSES, required: true },

    sanitizedArguments: { type: Schema.Types.Mixed, default: {} },
    resultSummary: { type: String, required: true },

    confirmedAt: { type: Date, default: null },
    executedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiActionAuditSchema.index({ organizationId: 1, createdAt: -1 });
aiActionAuditSchema.index({ organizationId: 1, status: 1 });

export const AIActionAudit: Model<AIActionAuditRecord> =
  (models.AIActionAudit as Model<AIActionAuditRecord>) ||
  model<AIActionAuditRecord>("AIActionAudit", aiActionAuditSchema);
