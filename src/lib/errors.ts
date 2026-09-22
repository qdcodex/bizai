import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "PRODUCT_NOT_FOUND"
  | "DUPLICATE_ITEM_CODE"
  | "CUSTOMER_NOT_FOUND"
  | "DUPLICATE_CUSTOMER_CODE"
  | "SUPPLIER_NOT_FOUND"
  | "DUPLICATE_SUPPLIER_CODE"
  | "QUOTATION_NOT_FOUND"
  | "INVENTORY_ITEM_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "INVALID_STOCK_OPERATION"
  | "BELOW_MIN_SELLING_PRICE"
  | "INVALID_STATUS_TRANSITION"
  | "APPROVAL_REQUIRED"
  | "RATE_LIMITED"
  | "AI_PROVIDER_ERROR"
  | "CONVERSATION_NOT_FOUND"
  | "ACTION_NOT_FOUND"
  | "ACTION_EXPIRED"
  | "ACTION_NOT_PENDING";

export class AppError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: ErrorCode; message: string };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(error: unknown): ApiFailure {
  if (error instanceof AppError) {
    return { success: false, error: { code: error.code, message: error.message } };
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Invalid input.";
    return { success: false, error: { code: "VALIDATION_ERROR", message } };
  }
  console.error(error);
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  };
}

export function statusFor(error: unknown): number {
  if (error instanceof AppError) return error.status;
  if (error instanceof ZodError) return 400;
  return 500;
}
