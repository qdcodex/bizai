"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FilterSelect({
  paramName,
  placeholder,
  options,
  defaultValue = "all",
}: {
  paramName: string;
  placeholder: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? defaultValue;

  function handleChange(nextValue: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextValue || nextValue === defaultValue) params.delete(paramName);
    else params.set(paramName, nextValue);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
