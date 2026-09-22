import { isStepCount } from "ai";
import { buildTools } from "@/ai/tools";
import type { ToolContext } from "@/ai/types";
import { wrapToolsWithGuardrails } from "@/ai/orchestrator/ToolExecutor";
import { getAllToolEntries } from "@/ai/orchestrator/ToolRegistry";
import { AI_MAX_TOOL_STEPS, workflowDurationStopCondition } from "@/ai/orchestrator/Guardrails";

/**
 * The thin orchestration seam between the chat route/service and the AI
 * SDK's own tool-calling loop. Deliberately does NOT implement a custom
 * multi-step reasoning engine — `streamText`'s built-in loop (bounded by
 * `stopWhen`) already handles "understand request -> choose tools -> execute
 * -> combine results -> respond"; this module only prepares a guarded
 * toolset and the stop conditions, and the chat service still calls
 * `streamText` directly.
 */
export function prepareOrchestratedRun(context: ToolContext) {
  const startedAt = Date.now();
  const rawTools = buildTools(context);
  const tools = wrapToolsWithGuardrails(rawTools, getAllToolEntries(), context);
  const stopWhen = [isStepCount(AI_MAX_TOOL_STEPS), workflowDurationStopCondition(startedAt)];

  return { tools, stopWhen, startedAt };
}

export type OrchestratedRun = ReturnType<typeof prepareOrchestratedRun>;
