import type { UIMessage } from "ai";
import type { HydratedDocument } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Conversation, type ConversationDocument } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { AppError } from "@/lib/errors";
import type { SessionPayload } from "@/lib/auth/session";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export async function createConversation(
  session: SessionPayload,
  title = "New conversation",
): Promise<ConversationSummary> {
  await connectToDatabase();
  const conversation = await Conversation.create({
    organizationId: session.organizationId,
    userId: session.userId,
    title,
  });
  return toSummary(conversation);
}

export async function listConversations(session: SessionPayload): Promise<ConversationSummary[]> {
  await connectToDatabase();
  const conversations = await Conversation.find({
    organizationId: session.organizationId,
    userId: session.userId,
  }).sort({ updatedAt: -1 });
  return conversations.map(toSummary);
}

/** Verifies the conversation belongs to the current user's organization AND the current user before returning it. */
export async function assertConversationOwnership(
  session: SessionPayload,
  conversationId: string,
): Promise<HydratedDocument<ConversationDocument>> {
  await connectToDatabase();
  const conversation = await Conversation.findOne({
    _id: conversationId,
    organizationId: session.organizationId,
    userId: session.userId,
  });
  if (!conversation) {
    throw new AppError("NOT_FOUND", "Conversation not found.", 404);
  }
  return conversation;
}

export async function renameConversation(
  session: SessionPayload,
  conversationId: string,
  title: string,
): Promise<ConversationSummary> {
  const conversation = await assertConversationOwnership(session, conversationId);
  conversation.title = title.trim().slice(0, 200) || "Untitled conversation";
  await conversation.save();
  return toSummary(conversation);
}

export async function deleteConversation(session: SessionPayload, conversationId: string): Promise<void> {
  const conversation = await assertConversationOwnership(session, conversationId);
  await Promise.all([
    Message.deleteMany({ conversationId: conversation._id }),
    conversation.deleteOne(),
  ]);
}

/** Loads a conversation's messages as UIMessage[], the shape useChat expects for initial hydration. */
export async function loadConversationMessages(
  session: SessionPayload,
  conversationId: string,
): Promise<UIMessage[]> {
  await assertConversationOwnership(session, conversationId);
  await connectToDatabase();

  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
  return messages.map((m) => ({
    id: m.messageId,
    role: m.role,
    parts: m.parts,
    metadata: m.metadata,
  })) as UIMessage[];
}

/**
 * Persists the full message list for a conversation after a chat turn
 * completes (called from the `onEnd` callback of `toUIMessageStream`).
 * Upserts by (conversationId, messageId) so this is safe to call repeatedly.
 */
export async function saveConversationMessages(
  organizationId: string,
  conversationId: string,
  messages: UIMessage[],
): Promise<void> {
  await connectToDatabase();

  await Promise.all(
    messages.map((message) =>
      Message.findOneAndUpdate(
        { conversationId, messageId: message.id },
        {
          conversationId,
          organizationId,
          messageId: message.id,
          role: message.role,
          parts: message.parts,
          metadata: (message as { metadata?: Record<string, unknown> }).metadata ?? {},
        },
        { upsert: true },
      ),
    ),
  );

  await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
}

/** Derives a short title from the first user message, used when a conversation is still "New conversation". */
export function deriveTitleFromMessage(message: UIMessage): string {
  const textPart = message.parts.find(
    (part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text",
  );
  const text = textPart?.text?.trim() ?? "";
  if (!text) return "New conversation";
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function toSummary(conversation: ConversationDocument): ConversationSummary {
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}
