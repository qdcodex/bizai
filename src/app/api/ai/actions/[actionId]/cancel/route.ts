import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { cancelPendingAction } from "@/ai/actions/action-manager";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ actionId: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { actionId } = await params;
    return cancelPendingAction(session, actionId);
  });
}
