import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import {
  CROSS_SITE_MUTATION_ERROR,
  isApiMutationPath,
  isSameOriginMutationAllowed,
} from "@/server/auth/requestGuards";
import { WORKSPACE_REQUEST_PATH_HEADER } from "@/server/auth/workspaceRedirect";
import { apiError } from "@/server/http/apiErrors";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/health",
  "/api/ready",
  "/manifest.webmanifest",
  "/manifest.json",
  "/apple-touch-icon.png",
]);

export function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;

  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/icons/")) return true;

  return false;
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    isApiMutationPath(pathname, req.method) &&
    !isSameOriginMutationAllowed({
      method: req.method,
      url: req.url,
      headers: req.headers,
      appBaseUrl: process.env.APP_BASE_URL,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: CROSS_SITE_MUTATION_ERROR },
      { status: 403 },
    );
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return apiError("UNAUTHENTICATED", 401);
    }

    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/app")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(WORKSPACE_REQUEST_PATH_HEADER, pathname + search);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
