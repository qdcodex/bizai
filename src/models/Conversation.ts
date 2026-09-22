import { Schema, model, models, Types, type Model } from "mongoose";

export interface ConversationDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New conversation", trim: true },
  },
  { timestamps: true },
);

conversationSchema.index({ organizationId: 1, userId: 1, updatedAt: -1 });

export const Conversation: Model<ConversationDocument> =
  (models.Conversation as Model<ConversationDocument>) ||
  model<ConversationDocument>("Conversation", conversationSchema);
