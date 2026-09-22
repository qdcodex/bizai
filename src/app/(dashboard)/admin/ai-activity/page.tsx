import { Activity, ListChecks, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/guards";
import { getActivityReport } from "@/ai/services/activity-service";

export default async function AdminAiActivityPage() {
  const session = await requireRole("admin");
  const report = await getActivityReport(session.organizationId);

  const completed = report.actionStatusCounts.COMPLETED ?? 0;
  const failed = report.actionStatusCounts.FAILED ?? 0;
  const cancelled = report.actionStatusCounts.CANCELLED ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Activity</h1>
        <p className="text-sm text-muted-foreground">
          Traceability for AI-proposed business actions and tool calls — most recent 50 of each.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={ListChecks} label="Actions Completed" value={String(completed)} />
        <StatCard icon={Activity} label="Actions Failed" value={String(failed)} />
        <StatCard icon={Wrench} label="Actions Cancelled" value={String(cancelled)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Actions (Audit Log)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.actionAudits.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No AI-proposed actions yet"
              description="Confirmed or cancelled write actions from the AI Assistant (e.g. quotations) will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.actionAudits.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.actionType}</TableCell>
                    <TableCell className="text-muted-foreground">{row.toolName}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{row.resultSummary}</TableCell>
                    <TableCell>{row.userName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tool Calls (Execution Log)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.toolExecutions.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No tool calls yet"
              description="Every AI Assistant tool call — read or write — will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.toolExecutions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.toolName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.operationType}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                      {row.errorCode && (
                        <span className="ml-2 text-xs text-muted-foreground">{row.errorCode}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.durationMs}ms</TableCell>
                    <TableCell>{row.userName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
