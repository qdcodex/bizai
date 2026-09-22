"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, RefreshCw, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { DocumentStatus } from "@/models/Document";

export function DocumentRowActions({
  documentId,
  name,
  status,
  canManage,
  canDelete,
}: {
  documentId: string;
  name: string;
  status: DocumentStatus;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();

  async function reprocess() {
    const response = await fetch(`/api/knowledge/${documentId}/reprocess`, { method: "POST" });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Reprocessing started");
    router.refresh();
  }

  async function archive() {
    const response = await fetch(`/api/knowledge/${documentId}/archive`, { method: "POST" });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Document archived");
    router.refresh();
  }

  async function remove() {
    const response = await fetch(`/api/knowledge/${documentId}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Document deleted");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" render={<Link href={`/knowledge/${documentId}`} />}>
        <Eye />
      </Button>
      {canManage && status !== "PROCESSING" && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm">
              <RefreshCw />
            </Button>
          }
          title="Reprocess document?"
          description={`"${name}" will be re-extracted, re-chunked, and re-embedded. This replaces its existing search index.`}
          confirmLabel="Reprocess"
          onConfirm={reprocess}
        />
      )}
      {canDelete && status !== "ARCHIVED" && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm">
              <Archive />
            </Button>
          }
          title="Archive document?"
          description={`"${name}" will be hidden from the knowledge base and no longer used by the AI Assistant.`}
          confirmLabel="Archive"
          onConfirm={archive}
        />
      )}
      {canDelete && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm">
              <Trash2 />
            </Button>
          }
          title="Delete document?"
          description={`"${name}" and all of its indexed content will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={remove}
        />
      )}
    </div>
  );
}
