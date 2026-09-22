import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { PendingAction, type PendingActionRecord, type PendingActionStatus } from "@/models/PendingAction";
import { AIActionAudit } from "@/models/AIActionAudit";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { createQuotation, submitQuotation } from "@/services/quotation.service";
import { recordStockMovement } from "@/services/stock-movement.service";
import { AI_ACTION_EXPIRY_MINUTES } from "@/ai/config";
import type { CreatePendingActionInput, PendingActionView, ActionExecutionResult } from "@/ai/actions/types";

function toView(doc: PendingActionRecord): PendingActionView {
  return {
    actionId: doc._id.toString(),
    actionType: doc.actionType,
    status: doc.status,
    preview: doc.preview,
    resultSummary: doc.resultSummary,
    resultData: doc.resultData,
    createdAt: doc.createdAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
    confirmedAt: doc.confirmedAt?.toISOString() ?? null,
    executedAt: doc.executedAt?.toISOString() ?? null,
  };
}

/**
 * The only place a confirmed AI-proposed action actually touches business
 * data — one entry per `ActionType`, calling the same server-side services
 * REST endpoints use. Extend this map (not the tool or the confirm route) to
 * add another confirmable write action in a future phase.
 */
const ACTION_EXECUTORS: Record<
  PendingActionRecord["actionType"],
  (session: SessionPayload, validatedArguments: Record<string, unknown>) => Promise<ActionExecutionResult>
> = {
  CREATE_QUOTATION: async (session, validatedArguments) => {
    const quotation = await createQuotation(session, validatedArguments as Parameters<typeof createQuotation>[1]);
    try {
      const submitted = await submitQuotation(session, quotation._id.toString());
      const summary =
        submitted.status === "PENDING_APPROVAL"
          ? `Quotation ${submitted.quotationNumber} was created and submitted for approval.`
          : `Quotation ${submitted.quotationNumber} was created and approved.`;
      return {
        summary,
        data: { quotationId: submitted._id.toString(), quotationNumber: submitted.quotationNumber, status: submitted.status },
      };
    } catch {
      // The quotation itself was created successfully; submission is a
      // secondary step, so a failure there is reported but not fatal.
      return {
        summary: `Quotation ${quotation.quotationNumber} was created as a draft, but could not be automatically submitted for approval.`,
        data: { quotationId: quotation._id.toString(), quotationNumber: quotation.quotationNumber, status: quotation.status },
      };
    }
  },

  ADJUST_STOCK: async (session, validatedArguments) => {
    const args = validatedArguments as { productId: string; direction: "IN" | "OUT"; quantity: number; notes?: string };
    const result = await recordStockMovement({
      organizationId: session.organizationId,
      productId: args.productId,
      type: args.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      quantity: args.quantity,
      referenceType: "MANUAL",
      notes: args.notes,
      createdBy: session.userId,
    });
    return {
      summary: `Stock adjusted from ${result.previousStock} to ${result.newStock}.`,
      data: { movementId: result.movementId, previousStock: result.previousStock, newStock: result.newStock },
    };
  },
};

export async function createPendingAction(input: CreatePendingActionInput): Promise<PendingActionView> {
  await connectToDatabase();

  const expiresAt = new Date(Date.now() + AI_ACTION_EXPIRY_MINUTES * 60_000);
  const doc = await PendingAction.create({
    organizationId: input.organizationId,
    userId: input.userId,
    conversationId: input.conversationId,
    actionType: input.actionType,
    toolName: input.toolName,
    requiredPermission: input.requiredPermission,
    validatedArguments: input.validatedArguments,
    preview: input.preview,
    status: "PENDING_CONFIRMATION",
    expiresAt,
  });

  return toView(doc);
}

/** Lazily flips a stale PENDING_CONFIRMATION action to EXPIRED. Never executes an expired action. */
async function expireIfNeeded(doc: NonNullable<Awaited<ReturnType<typeof PendingAction.findOne>>>): Promise<void> {
  if (doc.status === "PENDING_CONFIRMATION" && doc.expiresAt.getTime() <= Date.now()) {
    doc.status = "EXPIRED";
    await doc.save();
  }
}

async function findOwnedAction(session: SessionPayload, actionId: string) {
  if (!Types.ObjectId.isValid(actionId)) {
    throw new AppError("ACTION_NOT_FOUND", "Action not found.", 404);
  }
  await connectToDatabase();
  const doc = await PendingAction.findOne({
    _id: actionId,
    organizationId: session.organizationId,
    userId: session.userId,
  });
  if (!doc) {
    throw new AppError("ACTION_NOT_FOUND", "Action not found.", 404);
  }
  await expireIfNeeded(doc);
  return doc;
}

/** Fetches an action's current status/preview/result — used by the UI to reconcile state on reload. */
export async function getPendingActionView(session: SessionPayload, actionId: string): Promise<PendingActionView> {
  const doc = await findOwnedAction(session, actionId);
  return toView(doc);
}

export async function cancelPendingAction(session: SessionPayload, actionId: string): Promise<PendingActionView> {
  const doc = await findOwnedAction(session, actionId);

  if (doc.status !== "PENDING_CONFIRMATION") {
    // Cancelling is idempotent from the caller's point of view: if it's
    // already cancelled/completed/etc, just report the current state rather
    // than erroring — there's nothing unsafe about a repeat cancel click.
    return toView(doc);
  }

  doc.status = "CANCELLED";
  await doc.save();

  await AIActionAudit.create({
    organizationId: doc.organizationId,
    userId: doc.userId,
    conversationId: doc.conversationId,
    actionId: doc._id,
    actionType: doc.actionType,
    toolName: doc.toolName,
    status: "CANCELLED",
    sanitizedArguments: doc.validatedArguments,
    resultSummary: "Cancelled by user.",
  });

  return toView(doc);
}

/**
 * Confirms and executes a pending action exactly once. Concurrency-safe:
 * the PENDING_CONFIRMATION -> EXECUTING transition is a single atomic
 * `findOneAndUpdate` filtered on the current status, so of two simultaneous
 * confirm requests only one can win that update; the loser falls through to
 * the idempotent-replay branch below instead of re-running the write.
 */
export async function confirmPendingAction(
  session: SessionPayload,
  actionId: string,
): Promise<{ status: PendingActionStatus; resultSummary: string | null; data?: Record<string, unknown> }> {
  const existing = await findOwnedAction(session, actionId);

  if (existing.status !== "PENDING_CONFIRMATION") {
    // Idempotent replay: a second "Confirm" click (or a race) reports the
    // action's real current state instead of erroring or re-executing.
    if (existing.status === "COMPLETED") {
      return { status: "COMPLETED", resultSummary: existing.resultSummary, data: existing.resultData ?? undefined };
    }
    if (existing.status === "EXPIRED") {
      throw new AppError("ACTION_EXPIRED", "This action has expired. Please ask the assistant to prepare it again.", 410);
    }
    throw new AppError(
      "ACTION_NOT_PENDING",
      existing.status === "CANCELLED"
        ? "This action was already cancelled."
        : existing.status === "FAILED"
          ? "This action already failed and cannot be retried."
          : "This action is already being processed.",
      409,
    );
  }

  if (!can(session.role, existing.requiredPermission as Permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.", 403);
  }

  const claimed = await PendingAction.findOneAndUpdate(
    { _id: existing._id, status: "PENDING_CONFIRMATION" },
    { $set: { status: "EXECUTING", confirmedAt: new Date() } },
    { new: true },
  );
  if (!claimed) {
    // Another concurrent request won the race and already claimed it.
    const current = await PendingAction.findById(existing._id);
    if (current?.status === "COMPLETED") {
      return { status: "COMPLETED", resultSummary: current.resultSummary, data: current.resultData ?? undefined };
    }
    throw new AppError("ACTION_NOT_PENDING", "This action is already being processed.", 409);
  }

  const executor = ACTION_EXECUTORS[claimed.actionType];
  try {
    const result = await executor(session, claimed.validatedArguments);
    claimed.status = "COMPLETED";
    claimed.executedAt = new Date();
    claimed.resultSummary = result.summary;
    claimed.resultData = result.data;
    await claimed.save();

    await AIActionAudit.create({
      organizationId: claimed.organizationId,
      userId: claimed.userId,
      conversationId: claimed.conversationId,
      actionId: claimed._id,
      actionType: claimed.actionType,
      toolName: claimed.toolName,
      status: "COMPLETED",
      sanitizedArguments: claimed.validatedArguments,
      resultSummary: result.summary,
      confirmedAt: claimed.confirmedAt,
      executedAt: claimed.executedAt,
    });

    return { status: "COMPLETED", resultSummary: result.summary, data: result.data };
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : "Something went wrong creating this. Please try again.";
    claimed.status = "FAILED";
    claimed.resultSummary = message;
    await claimed.save();

    await AIActionAudit.create({
      organizationId: claimed.organizationId,
      userId: claimed.userId,
      conversationId: claimed.conversationId,
      actionId: claimed._id,
      actionType: claimed.actionType,
      toolName: claimed.toolName,
      status: "FAILED",
      sanitizedArguments: claimed.validatedArguments,
      resultSummary: message,
      confirmedAt: claimed.confirmedAt,
    });

    return { status: "FAILED", resultSummary: message };
  }
}
