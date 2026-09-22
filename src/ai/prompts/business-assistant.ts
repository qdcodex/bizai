import { BASE_SYSTEM_PROMPT } from "@/ai/prompts/system";
import type { Role } from "@/models/roles";

export interface AssistantPromptContext {
  organizationName: string;
  role: Role;
}

/** Builds the final instructions sent to the model for this request. */
export function buildAssistantInstructions(context: AssistantPromptContext): string {
  return `${BASE_SYSTEM_PROMPT}

## Current context

- Organization: ${context.organizationName}
- The current user's role is "${context.role}". Some tools may not be available to this role — if a tool you would normally use is missing from your toolset, that means this user does not have permission for it.`;
}
