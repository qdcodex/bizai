"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { toast } from "sonner";
import { Send, Square, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble } from "@/components/assistant/message-bubble";
import { SuggestedPrompts } from "@/components/assistant/suggested-prompts";
import { ErrorState } from "@/components/error-state";

export function ChatPanel({
  initialConversationId,
  initialMessages,
  onConversationCreated,
}: {
  initialConversationId: string | null;
  initialMessages: UIMessage[];
  onConversationCreated: (id: string, title: string) => void;
}) {
  const conversationIdRef = useRef<string | null>(initialConversationId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // No ref access here: `id` arrives via the per-call `body` override passed
  // to `sendMessage` (see handleSend), which DefaultChatTransport merges in
  // before calling prepareSendMessagesRequest — so this closure never touches
  // a ref, even though the real conversation id is only known at send time.
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, message: messages[messages.length - 1] },
        }),
      }),
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ensureConversation(firstMessageText: string): Promise<string> {
    if (conversationIdRef.current) return conversationIdRef.current;

    const response = await fetch("/api/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: firstMessageText.slice(0, 60) }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error.message);
    }
    conversationIdRef.current = result.data.id;
    window.history.replaceState(null, "", `/assistant/${result.data.id}`);
    onConversationCreated(result.data.id, result.data.title);
    return result.data.id;
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    let id: string;
    try {
      id = await ensureConversation(trimmed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start a new conversation.");
      return;
    }
    sendMessage({ text: trimmed }, { body: { id } });
    setInput("");
  }

  const isBusy = status === "submitted" || status === "streaming";
  const showEmptyState = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {showEmptyState ? (
        <SuggestedPrompts onSelect={handleSend} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 animate-pulse" />
                Thinking...
              </div>
            )}
            {error && (
              <div className="flex flex-col gap-2">
                <ErrorState description="Something went wrong generating a response." />
                <Button variant="outline" size="sm" className="self-start" onClick={() => regenerate()}>
                  <RotateCcw />
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t bg-background p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Ask about your business..."
            rows={1}
            className="min-h-10 flex-1 resize-none"
            disabled={isBusy}
          />
          {isBusy ? (
            <Button variant="outline" onClick={() => stop()}>
              <Square />
              Stop
            </Button>
          ) : (
            <Button onClick={() => handleSend(input)} disabled={!input.trim()}>
              <Send />
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
