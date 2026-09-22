import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentRowActions } from "@/components/knowledge/document-row-actions";
import { ProcessingPoller } from "@/components/knowledge/processing-poller";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { getDocument } from "@/services/document.service";
import { formatFileSize } from "@/lib/format";
import { AppError } from "@/lib/errors";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("knowledge.read");
  const { id } = await params;

  let doc;
  try {
    doc = await getDocument(session, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const canManage = can(session.role, "knowledge.create");
  const canDelete = can(session.role, "knowledge.delete");

  return (
    <div className="flex flex-col gap-6">
      <ProcessingPoller status={doc.status} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/knowledge" />}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{doc.name}</h1>
            <p className="text-sm text-muted-foreground">{doc.originalName}</p>
          </div>
        </div>
        <DocumentRowActions
          documentId={doc.id}
          name={doc.name}
          status={doc.status}
          canManage={canManage}
          canDelete={canDelete}
        />
      </div>

      {doc.status === "FAILED" && doc.processingError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Processing failed</p>
              <p className="text-sm text-muted-foreground">{doc.processingError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={doc.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Type / Size</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold uppercase">{doc.documentType}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{doc.pageCount ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Chunks Indexed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{doc.chunkCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Uploaded" value={new Date(doc.createdAt).toLocaleString()} />
          <Field label="Last Updated" value={new Date(doc.updatedAt).toLocaleString()} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
