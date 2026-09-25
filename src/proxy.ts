import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { moduleForApiPath, canAccessModule } from "@/lib/auth/module-access";

const AUTH_ONLY_PATHS = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // API routes: only gated-module prefixes reach the proxy (see matcher).
  // Unauthenticated requests pass through so the route returns its own 401.
  if (pathname.startsWith("/api/")) {
    const moduleKey = moduleForApiPath(pathname);
    if (session && moduleKey && !(await canAccessModule(session.organizationId, session.role, moduleKey))) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "This module has been turned off for your role." } },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  if (AUTH_ONLY_PATHS.includes(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/api/inventory/:path*",
    "/api/customers/:path*",
    "/api/suppliers/:path*",
    "/api/quotations/:path*",
    "/api/knowledge/:path*",
  ],
};
