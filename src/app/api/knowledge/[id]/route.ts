import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { deleteDocument, getDocument } from "@/services/document.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    return getDocument(session, id);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    await deleteDocument(session, id);
    return { deleted: true };
  });
}
