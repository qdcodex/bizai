import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerOrganizationAndOwner } from "@/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session";
import { ok, fail, statusFor, AppError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json(fail(new AppError("VALIDATION_ERROR", message)), {
      status: 400,
    });
  }

  try {
    const result = await registerOrganizationAndOwner(parsed.data);
    await setSessionCookie({
      userId: result.userId,
      organizationId: result.organizationId,
      role: result.role,
    });
    return NextResponse.json(ok(result), { status: 201 });
  } catch (error) {
    return NextResponse.json(fail(error), { status: statusFor(error) });
  }
}
