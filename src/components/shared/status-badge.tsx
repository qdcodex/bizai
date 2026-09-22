import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "warning" | "negative" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "",
  positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  negative: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
};

const STATUS_TONE: Record<string, Tone> = {
  IN_STOCK: "positive",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "negative",
  ACTIVE: "positive",
  INACTIVE: "neutral",
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  APPROVED: "positive",
  REJECTED: "negative",
  EXPIRED: "neutral",
  CONVERTED: "info",
  CANCELLED: "negative",
  UPLOADED: "neutral",
  PROCESSING: "warning",
  READY: "positive",
  FAILED: "negative",
  ARCHIVED: "neutral",
  PENDING_CONFIRMATION: "warning",
  CONFIRMED: "info",
  EXECUTING: "warning",
  COMPLETED: "positive",
  success: "positive",
  error: "negative",
};

const STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
  CANCELLED: "Cancelled",
  UPLOADED: "Uploaded",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
  ARCHIVED: "Archived",
  PENDING_CONFIRMATION: "Pending Confirmation",
  CONFIRMED: "Confirmed",
  EXECUTING: "Executing",
  COMPLETED: "Completed",
  success: "Success",
  error: "Error",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = STATUS_LABEL[status] ?? status;
  return (
    <Badge variant="secondary" className={cn(TONE_CLASSES[tone], className)}>
      {label}
    </Badge>
  );
}
