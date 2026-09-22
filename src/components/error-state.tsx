import { AlertCircle } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertCircle className="size-8 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
