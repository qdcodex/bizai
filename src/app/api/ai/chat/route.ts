import { NextRequest, NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { requireApiSession } from "@/lib/auth/guards";
import { getWorkspaceContext } from "@/services/workspace.service";
import { assertConversationOwnership, loadConversationMessages } from "@/ai/services/conversation-service";
import { runChatTurn } from "@/ai/services/chat-service";
import { rateLimiter } from "@/ai/services/rate-limit-service";
import { AppError, fail, statusFor } from "@/lib/errors";

interface ChatRequestBody {
  id?: string;
  message?: UIMessage;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();

    const body = (await request.json().catch(() => null)) as ChatRequestBody | null;
    if (!body || typeof body.id !== "string" || !body.message || typeof body.message !== "object") {
      throw new AppError("VALIDATION_ERROR", "A conversation id and message are required.", 400);
    }

    await assertConversationOwnership(session, body.id);

    const rateLimit = await rateLimiter.check(session.organizationId);
    if (!rateLimit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "Your organization has made too many AI requests in the last minute. Please wait a moment and try again.",
        429,
      );
    }

    const workspace = await getWorkspaceContext(session);
    const previousMessages = await loadConversationMessages(session, body.id);

    return await runChatTurn({
      session,
      organizationName: workspace.organization.name,
      moduleVisibility: workspace.organization.moduleVisibility,
      conversationId: body.id,
      previousMessages,
      newMessage: body.message,
    });
  } catch (error) {
    console.error("[api/ai/chat]", error);
    return NextResponse.json(fail(error), { status: statusFor(error) });
  }
}
