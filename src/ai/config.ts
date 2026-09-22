/**
 * Central Phase 5 configuration — orchestration guardrails and the
 * confirmable-action lifecycle are tuned via env vars, same convention as
 * src/ai/rag/config.ts.
 */

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Max tool-calling steps the model may take in a single chat turn. */
export const AI_MAX_TOOL_STEPS = numberEnv("AI_MAX_TOOL_STEPS", 8);
/** Per-tool-call timeout. */
export const AI_TOOL_TIMEOUT_MS = numberEnv("AI_TOOL_TIMEOUT_MS", 10_000);
/** Max array items returned to the model from any single tool result. */
export const AI_MAX_TOOL_RESULT_ITEMS = numberEnv("AI_MAX_TOOL_RESULT_ITEMS", 50);
/** Wall-clock cap for an entire chat turn's tool-calling loop. */
export const AI_MAX_WORKFLOW_DURATION_MS = numberEnv("AI_MAX_WORKFLOW_DURATION_MS", 30_000);
/** How long a proposed write action stays confirmable before it expires. */
export const AI_ACTION_EXPIRY_MINUTES = numberEnv("AI_ACTION_EXPIRY_MINUTES", 15);
/** Separate, tighter rate limit for confirming write actions (distinct from normal chat requests). */
export const AI_WRITE_ACTION_RATE_LIMIT_PER_MINUTE = numberEnv("AI_WRITE_ACTION_RATE_LIMIT_PER_MINUTE", 10);
/** How many identical (tool name + normalized args) calls are allowed before loop detection refuses further ones. */
export const AI_MAX_IDENTICAL_TOOL_CALLS = numberEnv("AI_MAX_IDENTICAL_TOOL_CALLS", 3);
