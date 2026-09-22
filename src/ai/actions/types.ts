import type { ActionType, PendingActionStatus } from "@/models/PendingAction";

export interface CreatePendingActionInput {
  organizationId: string;
  userId: string;
  conversationId: string;
  actionType: ActionType;
  toolName: string;
  requiredPermission: string;
  validatedArguments: Record<string, unknown>;
  preview: Record<string, unknown>;
}

export interface PendingActionView {
  actionId: string;
  actionType: ActionType;
  status: PendingActionStatus;
  preview: Record<string, unknown>;
  resultSummary: string | null;
  resultData: Record<string, unknown> | null;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  executedAt: string | null;
}

/** What an action-type's executor hands back on success — becomes the audit's resultSummary + the confirm response's `data`. */
export interface ActionExecutionResult {
  summary: string;
  data: Record<string, unknown>;
}
