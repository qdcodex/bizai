import { UploadForm } from "@/components/knowledge/upload-form";
import { requirePagePermission } from "@/lib/auth/permissions";
import { MAX_DOCUMENT_SIZE_MB } from "@/ai/rag/config";

export default async function UploadDocumentPage() {
  await requirePagePermission("knowledge.create");
  return (
    <div className="mx-auto w-full max-w-2xl">
      <UploadForm maxSizeMb={MAX_DOCUMENT_SIZE_MB} />
    </div>
  );
}
