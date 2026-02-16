import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "limni_session";
const SESSION_SECRETS = new Set(["admin", "viewer", "authenticated"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never serve raw MT5 source files from web routes.
  if (pathname.toLowerCase().endsWith(".mq5")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Allow login page and API/bot routes without auth
  if (pathname === "/login" || pathname.startsWith("/api/") || pathname.startsWith("/bot/")) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const session = request.cookies.get(SESSION_COOKIE_NAME);
  const isAuthenticated = session?.value ? SESSION_SECRETS.has(session.value) : false;

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|bot|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg).*)",
  ],
};
