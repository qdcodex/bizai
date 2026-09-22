import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Central model configuration — the only place a model id or provider is
 * chosen. Configurable via AI_MODEL so it can be changed per environment
 * without a code change; falls back to a solid, cost-effective default.
 *
 * Provider: Google Gemini. The API key is read explicitly from GEMINI_API_KEY
 * (rather than the provider's own default GOOGLE_GENERATIVE_AI_API_KEY) to
 * match this project's env var naming. Never exposed to the browser — this
 * module only ever runs server-side.
 */
export const AI_MODEL_ID = process.env.AI_MODEL?.trim() || "gemini-3.6-flash";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const aiModels = {
  assistant: google(AI_MODEL_ID),
};

/**
 * Approximate USD price per 1M tokens for supported models, used only to
 * estimate cost for the usage dashboard. Update when Google changes pricing;
 * unlisted models simply report a null estimated cost rather than a guess.
 */
const MODEL_PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 0.3, output: 2.5 },
  "gemini-flash-latest": { input: 0.3, output: 2.5 },
  "gemini-flash-lite-latest": { input: 0.1, output: 0.4 },
  "gemini-pro-latest": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = MODEL_PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return null;
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
