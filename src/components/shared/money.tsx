const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatMoney(value: number): string {
  return formatter.format(value);
}

export function MoneyDisplay({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{formatMoney(value)}</span>;
}
