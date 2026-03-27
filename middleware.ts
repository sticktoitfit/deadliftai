import { type NextRequest, NextResponse } from "next/server";

/**
 * Middleware-based route protection.
 *
 * WHY: Firebase Auth is client-side only. We use a session cookie (`fb-session`)
 * that the client sets on sign-in (see auth-context) to enable server-side redirects.
 * This prevents unauthenticated flashes on protected pages.
 *
 * Protected routes: /workout, /dashboard
 * Auth routes (redirect away if signed in): /auth
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("fb-session")?.value;

  const protectedPaths = ["/workout", "/dashboard"];
  const authPaths = ["/auth"];

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !session) {
    const loginUrl = new URL("/auth", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && session) {
    const workoutUrl = new URL("/workout", req.url);
    return NextResponse.redirect(workoutUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/workout/:path*", "/dashboard/:path*", "/auth"],
};
