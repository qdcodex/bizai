import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { roleAtLeast, type Role } from "@/models/roles";
import { AppError } from "@/lib/errors";

/** Redirects to /login when there is no valid session. Use at the top of protected Server Components. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Redirects to /dashboard when the current session's role is below the minimum required role. */
export async function requireRole(minimum: Role): Promise<SessionPayload> {
  const session = await requireSession();
  if (!roleAtLeast(session.role, minimum)) {
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

/** Route-handler variant of requireSession(): throws instead of redirecting, for JSON API responses. */
export async function requireApiSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AppError("UNAUTHORIZED", "You must be signed in.", 401);
  }
  return session;
}
