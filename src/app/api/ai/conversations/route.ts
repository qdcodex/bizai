import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { createConversation, listConversations } from "@/ai/services/conversation-service";
import { apiRoute } from "@/lib/api/respond";

export async function GET() {
  return apiRoute(async () => {
    const session = await requireApiSession();
    return listConversations(session);
  });
}

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : undefined;
    return createConversation(session, title);
  }, 201);
}
