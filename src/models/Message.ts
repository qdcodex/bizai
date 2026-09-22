import { Schema, model, models, Types, type Model } from "mongoose";

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/**
 * Stores AI SDK `UIMessage` objects. `parts` holds the SDK's own typed part
 * array (text, tool-call, tool-result, step-start, ...) as-is — this is the
 * "toolCalls"/"toolResults" data for this SDK version, kept as Mixed so the
 * schema can evolve with the SDK without a migration.
 */
export interface MessageDocument {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  organizationId: Types.ObjectId;
  messageId: string;
  role: MessageRole;
  parts: unknown[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const messageSchema = new Schema<MessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    messageId: { type: String, required: true },
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    parts: { type: [Schema.Types.Mixed], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, messageId: 1 }, { unique: true });

export const Message: Model<MessageDocument> =
  (models.Message as Model<MessageDocument>) || model<MessageDocument>("Message", messageSchema);
