"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Check, X, Clock, AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PendingActionStatus } from "@/models/PendingAction";

/**
 * Shared output shape every confirmable write tool's `execute` resolves to:
 * either a persisted PendingAction ready for confirmation, or an error the
 * tool caught itself (permission denied, rate limited, validation failure).
 * `TPreview` is the tool-specific, fully-priced/resolved preview shape.
 */
export type ConfirmableToolOutput<TPreview> =
  | { status: "pending_confirmation"; actionId: string; expiresAt: string; preview: TPreview }
  | { status: "error"; message: string }
  | { error: "permission_denied"; message: string };

type CardState<TPreview> =
  | { phase: "loading" }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string }
  | {
      phase: "action";
      actionId: string;
      status: PendingActionStatus;
      preview: TPreview;
      resultSummary: string | null;
      data?: Record<string, unknown>;
    }
  | { phase: "confirming"; actionId: string; preview: TPreview };

const STATUS_LABEL: Record<PendingActionStatus, string> = {
  PENDING_CONFIRMATION: "Waiting for confirmation",
  CONFIRMED: "Confirmed",
  EXECUTING: "Executing...",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

function isPermissionDenied<T>(
  output: ConfirmableToolOutput<T>,
): output is { error: "permission_denied"; message: string } {
  return "error" in output;
}

function initialCardState<T>(output: ConfirmableToolOutput<T>): CardState<T> {
  if (isPermissionDenied(output)) return { phase: "denied", message: output.message };
  if (output.status === "error") return { phase: "error", message: output.message };
  return { phase: "loading" };
}

export interface ActionCardProps<TPreview> {
  output: ConfirmableToolOutput<TPreview>;
  icon: LucideIcon;
  title: string;
  confirmLabel?: string;
  /** Renders the preview body (table, summary, etc.) shown while PENDING_CONFIRMATION/EXECUTING. */
  renderPreview: (preview: TPreview) => ReactNode;
  /** Optional: disable Confirm and show a reason, e.g. a business-rule violation in the preview. */
  confirmDisabled?: (preview: TPreview) => { disabled: boolean; reason?: string };
  /** Optional extra content (e.g. a "View" link) shown alongside the default completed message. */
  renderCompletedExtra?: (data: Record<string, unknown> | undefined) => ReactNode;
}

/**
 * Generic confirmation-card chrome for any write tool whose `execute`
 * resolves to `ConfirmableToolOutput` — reconciles the action's true current
 * status on mount (so a page reload never shows a stale "confirm this" card
 * for an action already resolved elsewhere), then drives Confirm/Cancel
 * through the generic /api/ai/actions/[id] endpoints. Tool-specific pieces
 * (the preview table, confirm-disabled business rules) are supplied by the
 * caller — see quotation-preview-card.tsx and stock-adjustment-card.tsx.
 */
export function ActionCard<TPreview>({
  output,
  icon: Icon,
  title,
  confirmLabel = "Confirm",
  renderPreview,
  confirmDisabled,
  renderCompletedExtra,
}: ActionCardProps<TPreview>) {
  const [state, setState] = useState<CardState<TPreview>>(() => initialCardState(output));

  useEffect(() => {
    if (isPermissionDenied(output) || output.status === "error") return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/ai/actions/${output.actionId}`);
        const result = await response.json();
        if (cancelled) return;
        if (!result.success) {
          setState({ phase: "error", message: result.error.message });
          return;
        }
        setState({
          phase: "action",
          actionId: output.actionId,
          status: result.data.status,
          preview: output.preview,
          resultSummary: result.data.resultSummary,
          data: result.data.resultData ?? undefined,
        });
      } catch {
        if (!cancelled) setState({ phase: "error", message: "Couldn't check this action's status." });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm(actionId: string, preview: TPreview) {
    setState({ phase: "confirming", actionId, preview });
    try {
      const response = await fetch(`/api/ai/actions/${actionId}/confirm`, { method: "POST" });
      const result = await response.json();
      if (!result.success) {
        setState({ phase: "action", actionId, status: "FAILED", preview, resultSummary: result.error.message });
        return;
      }
      setState({
        phase: "action",
        actionId,
        status: result.data.status,
        preview,
        resultSummary: result.data.resultSummary,
        data: result.data.data,
      });
    } catch {
      setState({
        phase: "action",
        actionId,
        status: "FAILED",
        preview,
        resultSummary: "Something went wrong completing this action.",
      });
    }
  }

  async function handleCancel(actionId: string, preview: TPreview) {
    try {
      const response = await fetch(`/api/ai/actions/${actionId}/cancel`, { method: "POST" });
      const result = await response.json();
      const status: PendingActionStatus = result.success ? result.data.status : "CANCELLED";
      setState({ phase: "action", actionId, status, preview, resultSummary: null });
    } catch {
      setState({ phase: "action", actionId, status: "CANCELLED", preview, resultSummary: null });
    }
  }

  if (state.phase === "loading") {
    return (
      <Card className="max-w-lg">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking action status...
        </CardContent>
      </Card>
    );
  }

  if (state.phase === "denied") {
    return (
      <Card className="max-w-lg border-destructive/30">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {state.message}
        </CardContent>
      </Card>
    );
  }

  if (state.phase === "error") {
    return (
      <Card className="max-w-lg border-destructive/30">
        <CardContent className="py-4 text-sm text-destructive">{state.message}</CardContent>
      </Card>
    );
  }

  const preview = state.preview;
  const busy = state.phase === "confirming";
  const status = state.phase === "confirming" ? "EXECUTING" : state.status;

  if (status === "COMPLETED") {
    return (
      <Card className="max-w-lg border-emerald-500/30">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Check className="size-4 shrink-0 text-emerald-600" />
            <span>{(state.phase === "action" ? state.resultSummary : null) ?? "Done."}</span>
          </div>
          {renderCompletedExtra?.(state.phase === "action" ? state.data : undefined)}
        </CardContent>
      </Card>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Card className="max-w-lg">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <X className="size-4" />
          Not applied.
        </CardContent>
      </Card>
    );
  }

  if (status === "EXPIRED") {
    return (
      <Card className="max-w-lg border-amber-500/30">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-amber-700">
          <Clock className="size-4 shrink-0" />
          This preview has expired. Ask the assistant to prepare it again.
        </CardContent>
      </Card>
    );
  }

  if (status === "FAILED") {
    return (
      <Card className="max-w-lg border-destructive/30">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {(state.phase === "action" ? state.resultSummary : null) ?? "Something went wrong."}
        </CardContent>
      </Card>
    );
  }

  // PENDING_CONFIRMATION or EXECUTING
  const disabledCheck = confirmDisabled?.(preview);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Icon className="size-4" />
            {title}
          </span>
          <Badge variant="secondary" className="font-normal">
            {STATUS_LABEL[status]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {renderPreview(preview)}
        {disabledCheck?.disabled && disabledCheck.reason && (
          <p className="text-xs text-destructive">{disabledCheck.reason}</p>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => handleCancel(state.actionId, preview)}
          disabled={busy || status !== "PENDING_CONFIRMATION"}
        >
          Cancel
        </Button>
        <Button
          onClick={() => handleConfirm(state.actionId, preview)}
          disabled={busy || status !== "PENDING_CONFIRMATION" || Boolean(disabledCheck?.disabled)}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
