import { isToolUIPart, type UIMessage } from "ai";
import { Sparkles, User } from "lucide-react";
import { Markdown } from "@/components/assistant/markdown";
import { ToolStatus } from "@/components/assistant/tool-status";
import { QuotationPreviewCard, type CreateQuotationToolOutput } from "@/components/assistant/quotation-preview-card";
import { StockAdjustmentCard, type AdjustStockToolOutput } from "@/components/assistant/stock-adjustment-card";
import { cn } from "@/lib/utils";

/**
 * Tools whose `execute` resolves to `ConfirmableToolOutput` (see
 * action-card.tsx) and therefore render a confirmation card instead of the
 * generic ToolStatus badge. Keep in sync with each tool's registry entry
 * (`requiresConfirmation: true`) in src/ai/tools/*.ts — this list is
 * client-safe (no server imports) precisely so it can live in this
 * client component.
 */
const CONFIRMABLE_TOOLS = ["createQuotation", "adjustStock"] as const;

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-muted" : "bg-primary/10",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5 text-primary" />}
      </div>
      <div className={cn("flex max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        {message.parts.map((part, index) => {
          if (part.type === "step-start") {
            return index > 0 ? <hr key={index} className="my-1 w-full border-border" /> : null;
          }

          if (part.type === "text") {
            if (!part.text) return null;
            return isUser ? (
              <div
                key={index}
                className="rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                {part.text}
              </div>
            ) : (
              <div key={index} className="rounded-2xl bg-muted px-4 py-2.5">
                <Markdown>{part.text}</Markdown>
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = part.type.slice("tool-".length);

            if ((CONFIRMABLE_TOOLS as readonly string[]).includes(toolName)) {
              // Confirmable write tools always have a server-side `execute`
              // (it only ever prepares a preview + PendingAction, never the
              // write itself), so the tool part resolves to
              // "output-available" immediately — there's no separate
              // "awaiting confirmation" wire state to handle here.
              if (part.state !== "output-available") return null;
              if (toolName === "createQuotation") {
                return <QuotationPreviewCard key={part.toolCallId} output={part.output as CreateQuotationToolOutput} />;
              }
              return <StockAdjustmentCard key={part.toolCallId} output={part.output as AdjustStockToolOutput} />;
            }

            if (part.state === "output-available") {
              return <ToolStatus key={part.toolCallId} toolName={toolName} state="done" />;
            }
            if (part.state === "output-error") {
              return <ToolStatus key={part.toolCallId} toolName={toolName} state="error" />;
            }
            return <ToolStatus key={part.toolCallId} toolName={toolName} state="in-progress" />;
          }

          return null;
        })}
      </div>
    </div>
  );
}
