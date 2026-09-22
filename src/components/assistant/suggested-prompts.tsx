import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "Which products are low in stock?",
  "How many Safety Helmets do we have?",
  "Show pending quotations",
  "Find ABC Industries",
  "Show recent stock movements",
];

export function SuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-6 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Ask your business assistant</h2>
        <p className="text-sm text-muted-foreground">
          Ask about inventory, customers, suppliers, and quotations — answers come from your real data.
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-2">
        {SUGGESTIONS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            className="justify-start font-normal"
            onClick={() => onSelect(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
