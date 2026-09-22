import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { ok } from "@/lib/errors";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json(ok({ loggedOut: true }));
}
