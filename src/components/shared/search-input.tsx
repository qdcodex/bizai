"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({
  placeholder = "Search...",
  paramName = "search",
}: {
  placeholder?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? "");

  const navRef = useRef({ router, pathname, searchParams, paramName });
  useEffect(() => {
    navRef.current = { router, pathname, searchParams, paramName };
  });

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const { router: r, pathname: p, searchParams: sp, paramName: pn } = navRef.current;
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(pn, value);
      else params.delete(pn);
      params.set("page", "1");
      r.push(`${p}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}
