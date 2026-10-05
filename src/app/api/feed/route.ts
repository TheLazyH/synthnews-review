import { NextResponse, type NextRequest } from "next/server";
import { getFeed, parseFeedQuery } from "@/lib/public-data";

export async function GET(req: NextRequest) {
  const parsed = parseFeedQuery(req.nextUrl.searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  return NextResponse.json(await getFeed(parsed.query));
}
