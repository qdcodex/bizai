import {
  AI_MAX_TOOL_STEPS,
  AI_TOOL_TIMEOUT_MS,
  AI_MAX_TOOL_RESULT_ITEMS,
  AI_MAX_WORKFLOW_DURATION_MS,
  AI_MAX_IDENTICAL_TOOL_CALLS,
} from "@/ai/config";

const SENSITIVE_KEY_RE = /password|token|secret|apikey|api_key|credential|authorization/i;

/** Deep-clones tool arguments while dropping anything that looks like a credential, for safe logging. */
export function sanitizeArguments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeArguments);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? "[redacted]" : sanitizeArguments(v);
    }
    return out;
  }
  return value;
}

/** Stable signature for loop detection — same tool + same (order-independent) arguments. */
export function toolCallSignature(toolName: string, args: unknown): string {
  return `${toolName}:${stableStringify(args)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${k}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Per-chat-turn loop detector: refuses a call once the same tool+args signature repeats beyond the threshold. */
export class LoopDetector {
  private readonly counts = new Map<string, number>();

  /** Returns true (and records the call) if this exact call is still allowed; false once the threshold is exceeded. */
  registerAndCheck(toolName: string, args: unknown): boolean {
    const signature = toolCallSignature(toolName, args);
    const count = (this.counts.get(signature) ?? 0) + 1;
    this.counts.set(signature, count);
    return count <= AI_MAX_IDENTICAL_TOOL_CALLS;
  }
}

export class ToolTimeoutError extends Error {
  constructor() {
    super("Tool call timed out.");
    this.name = "ToolTimeoutError";
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms = AI_TOOL_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError()), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Truncates any top-level array field of a tool result to
 * AI_MAX_TOOL_RESULT_ITEMS, so a broad query never dumps thousands of rows
 * into the model's context. The model can always narrow its query and ask
 * again — that's cheaper than reasoning over a huge result.
 */
export function limitResultArrays<T>(result: T, max = AI_MAX_TOOL_RESULT_ITEMS): T {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;

  let truncatedAny = false;
  const out: Record<string, unknown> = { ...(result as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (Array.isArray(value) && value.length > max) {
      out[key] = value.slice(0, max);
      truncatedAny = true;
    }
  }
  if (truncatedAny) {
    out.truncated = true;
    out.truncatedNote = `Only the first ${max} results are shown. Ask the user to narrow their request for more specific results.`;
  }
  return out as T;
}

/** Combined with isStepCount(AI_MAX_TOOL_STEPS) via stopWhen's array (OR semantics) to bound total turn duration. */
export function workflowDurationStopCondition(startedAt: number) {
  return () => Date.now() - startedAt > AI_MAX_WORKFLOW_DURATION_MS;
}

export { AI_MAX_TOOL_STEPS };
