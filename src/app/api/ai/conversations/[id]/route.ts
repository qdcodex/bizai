import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guards";
import { deleteConversation, renameConversation } from "@/ai/services/conversation-service";
import { apiRoute } from "@/lib/api/respond";

const renameSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const body = renameSchema.parse(await request.json());
    return renameConversation(session, id, body.title);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    await deleteConversation(session, id);
    return { deleted: true };
  });
}
