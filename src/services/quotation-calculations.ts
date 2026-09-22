import { AppError } from "@/lib/errors";

/**
 * Pure calculation and business-rule helpers for quotations — no database
 * access, so these are unit-tested directly. The server is the only place
 * these run; client-submitted totals are always discarded and recomputed.
 */

export interface QuotationLineInput {
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

export interface QuotationLineComputed extends QuotationLineInput {
  discount: number;
  tax: number;
  lineTotal: number;
}

export function computeLineTotal(line: QuotationLineInput): QuotationLineComputed {
  const discount = line.discount ?? 0;
  const tax = line.tax ?? 0;
  const lineSubtotal = line.quantity * line.unitPrice;
  const lineTotal = Math.max(0, lineSubtotal - discount + tax);
  return { ...line, discount, tax, lineTotal: round2(lineTotal) };
}

export interface QuotationTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export function computeQuotationTotals(lines: QuotationLineInput[]): QuotationTotals {
  const computed = lines.map(computeLineTotal);
  const subtotal = round2(computed.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
  const discount = round2(computed.reduce((sum, l) => sum + l.discount, 0));
  const tax = round2(computed.reduce((sum, l) => sum + l.tax, 0));
  const total = round2(subtotal - discount + tax);
  return { subtotal, discount, tax, total };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Enforces `unitPrice >= minSellingPrice` unless an authorized override is
 * both enabled for the organization and explicitly requested for this quote.
 */
export function assertMinSellingPrice(params: {
  itemName: string;
  unitPrice: number;
  minSellingPrice: number;
  overrideRequested: boolean;
  overrideAuthorized: boolean;
}): void {
  const { itemName, unitPrice, minSellingPrice, overrideRequested, overrideAuthorized } = params;
  if (unitPrice >= minSellingPrice) return;

  if (overrideRequested && overrideAuthorized) return;

  throw new AppError(
    "BELOW_MIN_SELLING_PRICE",
    `Unit price ₹${unitPrice} for "${itemName}" is below the minimum selling price of ₹${minSellingPrice}.` +
      (overrideRequested
        ? " Override is not permitted for your role or organization."
        : " Request an authorized override to proceed."),
    422,
  );
}

/** Whether a quotation total requires approval before it can move past DRAFT. */
export function requiresApproval(total: number, threshold: number): boolean {
  return total > threshold;
}
