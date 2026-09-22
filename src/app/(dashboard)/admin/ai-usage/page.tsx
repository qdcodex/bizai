import { Activity, Gauge, IndianRupee, MessageSquare, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/guards";
import { getOrganizationUsageReport } from "@/ai/services/usage-service";

export default async function AdminAiUsagePage() {
  const session = await requireRole("admin");
  const report = await getOrganizationUsageReport(session.organizationId, 30);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Usage</h1>
        <p className="text-sm text-muted-foreground">
          Token usage and estimated cost for the AI Assistant over the last 30 days.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MessageSquare} label="Total AI Requests" value={String(report.summary.totalRequests)} />
        <StatCard icon={Activity} label="Total Tokens" value={report.summary.totalTokens.toLocaleString()} />
        <StatCard
          icon={Gauge}
          label="Input / Output Tokens"
          value={`${report.summary.inputTokens.toLocaleString()} / ${report.summary.outputTokens.toLocaleString()}`}
        />
        <StatCard
          icon={IndianRupee}
          label="Estimated Cost"
          value={`$${report.summary.estimatedCostUsd.toFixed(4)}`}
          hint="Based on published Gemini pricing; informational only"
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Knowledge Base Embeddings</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={BookOpen}
            label="Embedding Requests"
            value={String(report.embeddingSummary.totalRequests)}
          />
          <StatCard
            icon={Activity}
            label="Embedding Tokens"
            value={report.embeddingSummary.totalTokens.toLocaleString()}
          />
          <StatCard
            icon={IndianRupee}
            label="Estimated Embedding Cost"
            value={`$${report.embeddingSummary.estimatedCostUsd.toFixed(4)}`}
            hint="Based on published Gemini pricing; informational only"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests by Day</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {report.byDay.length === 0 ? (
              <EmptyState icon={Activity} title="No usage yet" description="AI requests will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byDay.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right">{row.requests}</TableCell>
                      <TableCell className="text-right">{row.totalTokens.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by Model</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {report.byModel.length === 0 ? (
              <EmptyState icon={Gauge} title="No usage yet" description="Model usage will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byModel.map((row) => (
                    <TableRow key={row.model}>
                      <TableCell className="font-mono text-xs">{row.model}</TableCell>
                      <TableCell className="text-right">{row.requests}</TableCell>
                      <TableCell className="text-right">{row.totalTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${row.estimatedCostUsd.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Usage by User</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {report.byUser.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No usage yet" description="Per-user usage will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byUser.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell className="text-right">{row.requests}</TableCell>
                      <TableCell className="text-right">{row.totalTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${row.estimatedCostUsd.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
