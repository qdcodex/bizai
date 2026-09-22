import type { ToolSet } from "ai";
import { connectToDatabase } from "@/lib/db/connect";
import { AIToolExecution } from "@/models/AIToolExecution";
import type { ToolContext, ToolRegistryEntry } from "@/ai/types";
import { LoopDetector, sanitizeArguments, limitResultArrays, withTimeout, ToolTimeoutError } from "@/ai/orchestrator/Guardrails";

interface ToolWithExecute {
  execute?: (input: unknown, options: unknown) => Promise<unknown>;
  [key: string]: unknown;
}

async function logExecution(params: {
  context: ToolContext;
  toolName: string;
  operationType: "READ" | "WRITE";
  args: unknown;
  status: "success" | "error";
  durationMs: number;
  errorCode?: string;
}): Promise<void> {
  try {
    await connectToDatabase();
    await AIToolExecution.create({
      organizationId: params.context.organizationId,
      userId: params.context.userId,
      conversationId: params.context.conversationId,
      messageId: null,
      toolName: params.toolName,
      operationType: params.operationType,
      sanitizedArguments: sanitizeArguments(params.args) as Record<string, unknown>,
      status: params.status,
      durationMs: params.durationMs,
      errorCode: params.errorCode ?? null,
    });
  } catch (error) {
    // Logging must never break the actual tool call.
    console.error("[ai orchestrator] failed to record tool execution", error);
  }
}

/**
 * Wraps every tool's `execute` with the Phase 5 guardrails: per-turn loop
 * detection, a timeout, result-size limiting, and execution logging
 * (AIToolExecution). This is the single seam between the AI SDK's tool
 * calling and BizAI's orchestration concerns — tool business logic itself
 * (in src/ai/tools/*) is untouched.
 */
export function wrapToolsWithGuardrails(tools: ToolSet, registry: ToolRegistryEntry[], context: ToolContext): ToolSet {
  const registryByName = new Map(registry.map((entry) => [entry.name, entry]));
  const loopDetector = new LoopDetector();

  const wrapped: ToolSet = {};
  for (const [name, toolDef] of Object.entries(tools)) {
    const entry = registryByName.get(name);
    const original = (toolDef as ToolWithExecute).execute;
    if (!entry || !original) {
      wrapped[name] = toolDef;
      continue;
    }

    wrapped[name] = {
      ...toolDef,
      execute: async (input: unknown, options: unknown) => {
        if (!loopDetector.registerAndCheck(name, input)) {
          await logExecution({
            context,
            toolName: name,
            operationType: entry.mode === "write" ? "WRITE" : "READ",
            args: input,
            status: "error",
            durationMs: 0,
            errorCode: "LOOP_DETECTED",
          });
          return {
            error: "loop_detected",
            message: "This request seems to be repeating the same lookup. Please rephrase or narrow the request.",
          };
        }

        const startedAt = Date.now();
        try {
          const result = await withTimeout(Promise.resolve(original(input, options)));
          await logExecution({
            context,
            toolName: name,
            operationType: entry.mode === "write" ? "WRITE" : "READ",
            args: input,
            status: "success",
            durationMs: Date.now() - startedAt,
          });
          return limitResultArrays(result);
        } catch (error) {
          const isTimeout = error instanceof ToolTimeoutError;
          await logExecution({
            context,
            toolName: name,
            operationType: entry.mode === "write" ? "WRITE" : "READ",
            args: input,
            status: "error",
            durationMs: Date.now() - startedAt,
            errorCode: isTimeout ? "TIMEOUT" : "TOOL_ERROR",
          });
          if (isTimeout) {
            return { error: "timeout", message: "That took too long to complete. Please try again." };
          }
          throw error;
        }
      },
    } as ToolSet[string];
  }

  return wrapped;
}
