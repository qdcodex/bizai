"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { ConversationSidebar } from "@/components/assistant/conversation-sidebar";
import { ChatPanel } from "@/components/assistant/chat-panel";

export function AssistantShell({
  conversationId,
  initialMessages,
  initialInput,
}: {
  conversationId: string | null;
  initialMessages: UIMessage[];
  initialInput?: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeId, setActiveId] = useState(conversationId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden rounded-lg border">
      <ConversationSidebar activeConversationId={activeId} refreshKey={refreshKey} />
      <ChatPanel
        key={conversationId ?? "new"}
        initialConversationId={conversationId}
        initialMessages={initialMessages}
        initialInput={initialInput}
        onConversationCreated={(id) => {
          setActiveId(id);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
