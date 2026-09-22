import { NextRequest, after } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { markDocumentForReprocessing, processDocument } from "@/services/document.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const summary = await markDocumentForReprocessing(session, id);
    after(() => processDocument(id));
    return summary;
  });
}
