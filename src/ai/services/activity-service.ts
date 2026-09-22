import { connectToDatabase } from "@/lib/db/connect";
import { AIActionAudit } from "@/models/AIActionAudit";
import { AIToolExecution } from "@/models/AIToolExecution";

const RECENT_LIMIT = 50;

export interface ActionAuditRow {
  id: string;
  actionType: string;
  toolName: string;
  status: string;
  resultSummary: string;
  userName: string;
  createdAt: string;
  executedAt: string | null;
}

export interface ToolExecutionRow {
  id: string;
  toolName: string;
  operationType: "READ" | "WRITE";
  status: "success" | "error";
  durationMs: number;
  errorCode: string | null;
  userName: string;
  createdAt: string;
}

export interface ActivityReport {
  actionAudits: ActionAuditRow[];
  toolExecutions: ToolExecutionRow[];
  actionStatusCounts: Record<string, number>;
}

/**
 * Powers /admin/ai-activity — a read-only view over the traceability data
 * Phase 5 already records (AIActionAudit for confirmed write actions,
 * AIToolExecution for every tool call). Shows the most recent rows rather
 * than a fully paginated browser, since this is a diagnostic/audit surface,
 * not a business list page.
 */
export async function getActivityReport(organizationId: string): Promise<ActivityReport> {
  await connectToDatabase();

  const [audits, executions] = await Promise.all([
    AIActionAudit.find({ organizationId })
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .populate<{ userId: { name: string } | null }>("userId", "name"),
    AIToolExecution.find({ organizationId })
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .populate<{ userId: { name: string } | null }>("userId", "name"),
  ]);

  const actionAudits: ActionAuditRow[] = audits.map((a) => ({
    id: a._id.toString(),
    actionType: a.actionType,
    toolName: a.toolName,
    status: a.status,
    resultSummary: a.resultSummary,
    userName: (a.userId as unknown as { name: string } | null)?.name ?? "Unknown user",
    createdAt: a.createdAt.toISOString(),
    executedAt: a.executedAt ? a.executedAt.toISOString() : null,
  }));

  const toolExecutions: ToolExecutionRow[] = executions.map((e) => ({
    id: e._id.toString(),
    toolName: e.toolName,
    operationType: e.operationType,
    status: e.status,
    durationMs: e.durationMs,
    errorCode: e.errorCode,
    userName: (e.userId as unknown as { name: string } | null)?.name ?? "Unknown user",
    createdAt: e.createdAt.toISOString(),
  }));

  const actionStatusCounts: Record<string, number> = {};
  for (const row of actionAudits) {
    actionStatusCounts[row.status] = (actionStatusCounts[row.status] ?? 0) + 1;
  }

  return { actionAudits, toolExecutions, actionStatusCounts };
}
