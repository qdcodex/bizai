import { describe, it, expect } from "vitest";
import { LoopDetector, sanitizeArguments, limitResultArrays, withTimeout, ToolTimeoutError, toolCallSignature } from "@/ai/orchestrator/Guardrails";

describe("LoopDetector", () => {
  it("allows a call up to the identical-call threshold, then refuses further identical calls", () => {
    const detector = new LoopDetector();
    const args = { query: "helmet" };
    // Default threshold is 3 (AI_MAX_IDENTICAL_TOOL_CALLS) unless overridden by env.
    const results = Array.from({ length: 6 }, () => detector.registerAndCheck("searchProducts", args));
    expect(results.slice(0, 3)).toEqual([true, true, true]);
    expect(results.slice(3)).toEqual([false, false, false]);
  });

  it("treats different arguments as a different call, not a repeat", () => {
    const detector = new LoopDetector();
    expect(detector.registerAndCheck("searchProducts", { query: "helmet" })).toBe(true);
    expect(detector.registerAndCheck("searchProducts", { query: "drill" })).toBe(true);
    expect(detector.registerAndCheck("searchProducts", { query: "drill" })).toBe(true);
  });

  it("treats key order as irrelevant to the call signature", () => {
    expect(toolCallSignature("t", { a: 1, b: 2 })).toBe(toolCallSignature("t", { b: 2, a: 1 }));
  });

  it("tracks different tool names independently", () => {
    const detector = new LoopDetector();
    const args = { id: "1" };
    detector.registerAndCheck("getProduct", args);
    detector.registerAndCheck("getProduct", args);
    detector.registerAndCheck("getProduct", args);
    // A different tool with the same args is unaffected by getProduct's count.
    expect(detector.registerAndCheck("getCustomer", args)).toBe(true);
  });
});

describe("sanitizeArguments", () => {
  it("redacts keys that look like credentials, recursively", () => {
    const sanitized = sanitizeArguments({
      customerId: "abc",
      apiKey: "secret-value",
      nested: { password: "hunter2", quantity: 5 },
    }) as Record<string, unknown>;
    expect(sanitized.customerId).toBe("abc");
    expect(sanitized.apiKey).toBe("[redacted]");
    expect((sanitized.nested as Record<string, unknown>).password).toBe("[redacted]");
    expect((sanitized.nested as Record<string, unknown>).quantity).toBe(5);
  });

  it("leaves plain business arguments untouched", () => {
    const input = { productId: "p1", quantity: 10 };
    expect(sanitizeArguments(input)).toEqual(input);
  });
});

describe("limitResultArrays", () => {
  it("truncates a top-level array beyond the max and flags it", () => {
    const result = { count: 100, products: Array.from({ length: 100 }, (_, i) => i) };
    const limited = limitResultArrays(result, 10) as typeof result & { truncated?: boolean };
    expect(limited.products).toHaveLength(10);
    expect(limited.truncated).toBe(true);
  });

  it("leaves a result under the limit unchanged", () => {
    const result = { count: 3, products: [1, 2, 3] };
    const limited = limitResultArrays(result, 10) as typeof result & { truncated?: boolean };
    expect(limited.products).toEqual([1, 2, 3]);
    expect(limited.truncated).toBeUndefined();
  });

  it("passes through non-object results (e.g. a plain error message shape) unchanged", () => {
    const result = { status: "not_found", message: "x" };
    expect(limitResultArrays(result, 10)).toEqual(result);
  });
});

describe("withTimeout", () => {
  it("resolves normally when the work finishes before the timeout", async () => {
    await expect(withTimeout(Promise.resolve("done"), 50)).resolves.toBe("done");
  });

  it("rejects with ToolTimeoutError once the timeout elapses", async () => {
    const neverResolves = new Promise(() => {});
    await expect(withTimeout(neverResolves, 20)).rejects.toBeInstanceOf(ToolTimeoutError);
  });
});
