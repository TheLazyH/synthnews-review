import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readToken } from "@/lib/token";

const PUBLIC_PATH = /^\/(?:stories(?:\/[^/]+)?|api\/feed)?$/;

function isPublic(req: NextRequest, path: string) {
  return (
    (req.method === "GET" || req.method === "HEAD") && PUBLIC_PATH.test(path)
  );
}

export async function proxy(req: NextRequest) {
  const session = await readToken(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;
  const isLogin = path === "/login";

  if (!session && !isLogin && !isPublic(req, path)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/review", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth/login|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
