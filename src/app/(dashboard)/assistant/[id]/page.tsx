import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { requireSession } from "@/lib/auth/guards";
import { loadConversationMessages } from "@/ai/services/conversation-service";
import { AssistantShell } from "@/components/assistant/assistant-shell";
import { AppError } from "@/lib/errors";

export default async function AssistantConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  let messages: UIMessage[];
  try {
    messages = await loadConversationMessages(session, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return <AssistantShell conversationId={id} initialMessages={messages} />;
}
