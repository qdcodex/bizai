import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/empty-state";
import { DocumentRowActions } from "@/components/knowledge/document-row-actions";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { documentQuerySchema } from "@/lib/validation/document";
import { flattenSearchParams } from "@/lib/validation/pagination";
import { listDocuments } from "@/services/document.service";
import { formatFileSize } from "@/lib/format";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("knowledge.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = documentQuerySchema.parse(rawParams);

  const { data: documents, pagination } = await listDocuments(session, query);
  const canManage = can(session.role, "knowledge.create");
  const canDelete = can(session.role, "knowledge.delete");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            Upload documents to ground the AI Assistant&rsquo;s answers in your own content.
          </p>
        </div>
        {canManage && (
          <Button render={<Link href="/knowledge/upload" />}>
            <Plus />
            Upload Document
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by document name..." />
        <FilterSelect
          paramName="documentType"
          placeholder="Type"
          options={[
            { label: "All Types", value: "all" },
            { label: "PDF", value: "pdf" },
            { label: "TXT", value: "txt" },
          ]}
        />
        <FilterSelect
          paramName="status"
          placeholder="Status"
          options={[
            { label: "All Statuses", value: "all" },
            { label: "Uploaded", value: "UPLOADED" },
            { label: "Processing", value: "PROCESSING" },
            { label: "Ready", value: "READY" },
            { label: "Failed", value: "FAILED" },
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No documents found"
              description="Upload a PDF or TXT file to start building your knowledge base."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell className="text-muted-foreground uppercase">{doc.documentType}</TableCell>
                      <TableCell className="text-muted-foreground">{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell className="text-muted-foreground">{doc.pageCount ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{doc.chunkCount}</TableCell>
                      <TableCell>
                        <StatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DocumentRowActions
                          documentId={doc.id}
                          name={doc.name}
                          status={doc.status}
                          canManage={canManage}
                          canDelete={canDelete}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar pagination={pagination} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
