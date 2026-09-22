"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/shared/money";
import type { ProductSearchResult } from "@/services/product.service";

export function ProductSelector({
  value,
  label,
  onSelect,
  placeholder = "Search products...",
}: {
  value?: string;
  label?: string;
  onSelect: (product: ProductSearchResult) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const currentRequest = ++requestId.current;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=20`);
        const result = await response.json();
        if (currentRequest === requestId.current && result.success) {
          setResults(result.data);
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
        <span className={cn("truncate", !label && "text-muted-foreground")}>
          {label ?? placeholder}
        </span>
        <ChevronsUpDown className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> Searching...
              </div>
            ) : (
              <>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {results.map((product) => (
                    <CommandItem
                      key={product.productId}
                      value={product.productId}
                      onSelect={() => {
                        onSelect(product);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(value === product.productId ? "opacity-100" : "opacity-0")}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{product.itemName}</span>
                        <span className="text-xs text-muted-foreground">
                          {product.itemCode} · {formatMoney(product.sellingPrice)} · Stock: {product.currentStock}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
