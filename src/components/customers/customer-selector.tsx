"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { CustomerSearchResult } from "@/services/customer.service";

export function CustomerSelector({
  value,
  label,
  onSelect,
  placeholder = "Search customers...",
}: {
  value?: string;
  label?: string;
  onSelect: (customer: CustomerSearchResult) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const currentRequest = ++requestId.current;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}&limit=20`);
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
                <CommandEmpty>No customers found.</CommandEmpty>
                <CommandGroup>
                  {results.map((customer) => (
                    <CommandItem
                      key={customer.customerId}
                      value={customer.customerId}
                      onSelect={() => {
                        onSelect(customer);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(value === customer.customerId ? "opacity-100" : "opacity-0")}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.customerCode}
                          {customer.companyName ? ` · ${customer.companyName}` : ""}
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
