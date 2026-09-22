import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { getPendingActionView } from "@/ai/actions/action-manager";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ actionId: string }>;
}

/** Backs the AI Assistant's action confirmation card — reconciles its displayed status on load/reload. */
export async function GET(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { actionId } = await params;
    return getPendingActionView(session, actionId);
  });
}
