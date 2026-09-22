import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { loadConversationMessages } from "@/ai/services/conversation-service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    return loadConversationMessages(session, id);
  });
}
