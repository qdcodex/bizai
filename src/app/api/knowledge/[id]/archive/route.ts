import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { archiveDocument } from "@/services/document.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    return archiveDocument(session, id);
  });
}
