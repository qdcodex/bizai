import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { aiModels, AI_MODEL_ID } from "@/ai/models/config";
import { buildAssistantInstructions } from "@/ai/prompts/business-assistant";
import { prepareOrchestratedRun } from "@/ai/orchestrator/AgentOrchestrator";
import { recordAIUsage } from "@/ai/services/usage-service";
import { saveConversationMessages } from "@/ai/services/conversation-service";
import type { SessionPayload } from "@/lib/auth/session";
import type { ToolContext } from "@/ai/types";
import type { ModuleVisibility } from "@/lib/auth/modules";

export interface RunChatTurnInput {
  session: SessionPayload;
  organizationName: string;
  moduleVisibility: ModuleVisibility;
  conversationId: string;
  previousMessages: UIMessage[];
  newMessage: UIMessage;
}

/**
 * Runs one assistant turn: validates the incoming message against the
 * current toolset, streams the model's response (with tool calls executed
 * server-side through the Phase 2 business services), and — independently
 * of whether the client stays connected — persists the updated conversation
 * and records token usage once the turn finishes.
 */
export async function runChatTurn(input: RunChatTurnInput): Promise<Response> {
  const context: ToolContext = {
    organizationId: input.session.organizationId,
    userId: input.session.userId,
    role: input.session.role,
    conversationId: input.conversationId,
    moduleVisibility: input.moduleVisibility,
  };
  const { tools, stopWhen, startedAt } = prepareOrchestratedRun(context);

  const allMessages = [...input.previousMessages, input.newMessage];
  const validatedMessages = await validateUIMessages({ messages: allMessages, tools });

  const instructions = buildAssistantInstructions({
    organizationName: input.organizationName,
    role: input.session.role,
  });

  const result = streamText({
    model: aiModels.assistant,
    instructions,
    messages: await convertToModelMessages(validatedMessages),
    tools,
    stopWhen,
    onEnd: async ({ usage, toolCalls, stepNumber }) => {
      const ragRetrievalCount = toolCalls.filter((call) => call.toolName === "searchKnowledgeBase").length;
      await recordAIUsage({
        organizationId: input.session.organizationId,
        userId: input.session.userId,
        conversationId: input.conversationId,
        model: AI_MODEL_ID,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        durationMs: Date.now() - startedAt,
        toolStepCount: stepNumber + 1,
        ragRetrievalCount,
      });
    },
  });

  // Keep generating and persisting even if the client disconnects mid-stream.
  result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: validatedMessages,
      onError: (error) => {
        console.error("[ai chat] stream error", error);
        return "I couldn't process that request right now. Please try again.";
      },
      onEnd: async ({ messages }) => {
        await saveConversationMessages(input.session.organizationId, input.conversationId, messages);
      },
    }),
  });
}
