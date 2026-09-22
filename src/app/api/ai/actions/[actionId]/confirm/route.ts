import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { confirmPendingAction } from "@/ai/actions/action-manager";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ actionId: string }>;
}

/**
 * Confirms and executes a pending AI-proposed action exactly once. The
 * server re-checks permission, ownership, expiry, and current status before
 * ever calling the real business service — the LLM's tool call only ever
 * produced the preview + PendingAction record, never the write itself.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { actionId } = await params;
    return confirmPendingAction(session, actionId);
  });
}
