export interface ToolExecutionSummary {
  toolName: string;
  status: "success" | "error";
  durationMs: number;
  errorCode?: string;
}

export type WorkflowStatus = "COMPLETED" | "NEEDS_CONFIRMATION" | "FAILED" | "CANCELLED";

export interface WorkflowSource {
  documentName: string;
  pageNumber: number | null;
}

/**
 * Typed shape for reporting a chat turn's outcome. Not currently threaded
 * through the streaming response body (the AI SDK's UIMessage stream is the
 * transport), but used by tests and available for a future non-streaming
 * surface — see AgentOrchestrator.summarize().
 */
export interface WorkflowResult {
  status: WorkflowStatus;
  answer: string;
  sources?: WorkflowSource[];
  toolExecutions?: ToolExecutionSummary[];
  pendingActionId?: string;
  metadata?: {
    durationMs?: number;
    toolStepCount?: number;
  };
}
