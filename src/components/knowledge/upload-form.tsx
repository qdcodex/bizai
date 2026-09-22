"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "@/lib/format";

const ACCEPTED_EXTENSIONS = [".pdf", ".txt"];

export function UploadForm({ maxSizeMb }: { maxSizeMb: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(selected: File | null) {
    if (!selected) {
      setFile(null);
      return;
    }
    const ext = selected.name.slice(selected.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error("Only PDF and TXT files are supported.");
      return;
    }
    if (selected.size > maxSizeMb * 1024 * 1024) {
      toast.error(`File is too large. Maximum size is ${maxSizeMb} MB.`);
      return;
    }
    setFile(selected);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/knowledge", { method: "POST", body: formData });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Document uploaded — processing in the background");
      router.push(`/knowledge/${result.data.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed p-10 text-center transition-colors hover:bg-muted/50"
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            {file ? (
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Click to choose a file</p>
                <p className="text-xs text-muted-foreground">PDF or TXT, up to {maxSizeMb} MB</p>
              </div>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !file}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Upload
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
