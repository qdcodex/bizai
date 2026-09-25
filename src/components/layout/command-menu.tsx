"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus, PackagePlus, Search, Sparkles, UserPlus } from "lucide-react";
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/lib/nav";

export interface QuickAction {
  label: string;
  href: string;
  icon: "quotation" | "product" | "customer";
}

const QUICK_ACTION_ICONS = { quotation: FilePlus, product: PackagePlus, customer: UserPlus };

/**
 * Ctrl/⌘+K palette: jump to any page the user can see, run a quick-create
 * action, or hand a free-text question straight to the AI assistant.
 */
export function CommandMenu({ navItems, quickActions }: { navItems: NavItem[]; quickActions: QuickAction[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-full max-w-sm justify-start gap-2 bg-muted/40 px-3 font-normal text-muted-foreground shadow-none"
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className="truncate">Search or jump to...</span>
        <kbd className="pointer-events-none ml-auto hidden rounded border bg-background px-1.5 font-mono text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page or run an action">
        <Command>
          <CommandInput placeholder="Type a page, action, or question..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {query.trim() && (
              <CommandGroup heading="AI Assistant">
                <CommandItem
                  value={`ask ${query}`}
                  onSelect={() => go(`/assistant?q=${encodeURIComponent(query.trim())}`)}
                >
                  <Sparkles />
                  <span className="truncate">Ask AI: “{query.trim()}”</span>
                </CommandItem>
              </CommandGroup>
            )}
            {quickActions.length > 0 && (
              <CommandGroup heading="Create">
                {quickActions.map((action) => {
                  const Icon = QUICK_ACTION_ICONS[action.icon];
                  return (
                    <CommandItem key={action.href} value={action.label} onSelect={() => go(action.href)}>
                      <Icon />
                      {action.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            <CommandGroup heading="Go to">
              {navItems.map((item) => (
                <CommandItem key={item.href} value={item.title} onSelect={() => go(item.href)}>
                  <item.icon />
                  {item.title}
                  <CommandShortcut>{item.href}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
