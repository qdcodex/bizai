"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

export interface ConversationListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function groupByRecency(conversations: ConversationListItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: ConversationListItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conversation of conversations) {
    const updated = new Date(conversation.updatedAt);
    if (updated >= today) groups[0].items.push(conversation);
    else if (updated >= yesterday) groups[1].items.push(conversation);
    else groups[2].items.push(conversation);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ConversationSidebar({
  activeConversationId,
  refreshKey,
}: {
  activeConversationId: string | null;
  refreshKey: number;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/ai/conversations");
        const result = await response.json();
        if (!cancelled && result.success) setConversations(result.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [refreshKey]);

  async function handleRename(id: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    const response = await fetch(`/api/ai/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    const result = await response.json();
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      router.push("/assistant");
    }
  }

  const filtered = search.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()))
    : conversations;
  const groups = groupByRecency(filtered);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r">
      <div className="flex flex-col gap-2 border-b p-3">
        <Button className="w-full justify-start" render={<Link href="/assistant" />}>
          <Plus />
          New conversation
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!loading && conversations.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <MessageSquare className="size-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No conversations yet.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                    activeConversationId === conversation.id && "bg-muted",
                  )}
                >
                  {renamingId === conversation.id ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(conversation.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(conversation.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-6 flex-1 text-xs"
                    />
                  ) : (
                    <Link href={`/assistant/${conversation.id}`} className="min-w-0 flex-1 truncate">
                      {conversation.title}
                    </Link>
                  )}
                  {renamingId !== conversation.id && (
                    <div className="hidden items-center gap-0.5 group-hover:flex">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setRenamingId(conversation.id);
                          setRenameValue(conversation.title);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-xs">
                            <Trash2 />
                          </Button>
                        }
                        title="Delete this conversation?"
                        description="This conversation and its messages will be permanently deleted."
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => handleDelete(conversation.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
