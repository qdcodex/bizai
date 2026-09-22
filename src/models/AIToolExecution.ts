import { Schema, model, models, Types, type Model } from "mongoose";

export const AI_TOOL_EXECUTION_STATUSES = ["success", "error"] as const;
export type AIToolExecutionStatus = (typeof AI_TOOL_EXECUTION_STATUSES)[number];

/**
 * One row per tool call the orchestrator executes, for observability and
 * traceability — separate from AIActionAudit, which only covers confirmed
 * write actions. Arguments are sanitized before storage (see ToolExecutor);
 * never store secrets/tokens/credentials here.
 */
export interface AIToolExecutionRecord {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageId: string | null;

  toolName: string;
  operationType: "READ" | "WRITE";
  sanitizedArguments: Record<string, unknown>;

  status: AIToolExecutionStatus;
  durationMs: number;
  errorCode: string | null;

  createdAt: Date;
}

const aiToolExecutionSchema = new Schema<AIToolExecutionRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    messageId: { type: String, default: null },

    toolName: { type: String, required: true },
    operationType: { type: String, enum: ["READ", "WRITE"], required: true },
    sanitizedArguments: { type: Schema.Types.Mixed, default: {} },

    status: { type: String, enum: AI_TOOL_EXECUTION_STATUSES, required: true },
    durationMs: { type: Number, required: true },
    errorCode: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiToolExecutionSchema.index({ organizationId: 1, conversationId: 1, createdAt: -1 });

export const AIToolExecution: Model<AIToolExecutionRecord> =
  (models.AIToolExecution as Model<AIToolExecutionRecord>) ||
  model<AIToolExecutionRecord>("AIToolExecution", aiToolExecutionSchema);
