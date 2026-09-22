import { can, type Permission } from "@/lib/auth/permissions";
import type { ToolContext } from "@/ai/types";

export interface PermissionDenied {
  error: "permission_denied";
  message: string;
}

/**
 * Defense-in-depth permission check run inside every tool's `execute`, even
 * though tools are also filtered out of the toolset entirely for roles that
 * lack the permission (see `ai/tools/index.ts`). Returns a structured denial
 * for the model to relay in natural language, rather than throwing and
 * surfacing a raw error to the chat.
 */
export function checkToolPermission(context: ToolContext, permission: Permission): PermissionDenied | null {
  if (can(context.role, permission)) return null;
  return {
    error: "permission_denied",
    message: `The current user's role does not have permission to perform this action (${permission}).`,
  };
}
