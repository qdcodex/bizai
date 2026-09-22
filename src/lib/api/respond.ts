import { NextResponse } from "next/server";
import { ok, fail, statusFor } from "@/lib/errors";

/** Runs a route handler body, translating thrown AppErrors/ZodErrors into the standard {success,...} JSON shape. */
export async function apiRoute<T>(fn: () => Promise<T>, successStatus = 200): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(ok(data), { status: successStatus });
  } catch (error) {
    return NextResponse.json(fail(error), { status: statusFor(error) });
  }
}

export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) obj[key] = value;
  return obj;
}
