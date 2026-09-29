import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readToken } from "@/lib/token";

export async function proxy(req: NextRequest) {
  const session = await readToken(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;
  const isLogin = path === "/login";

  if (!session && !isLogin) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth/login|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
