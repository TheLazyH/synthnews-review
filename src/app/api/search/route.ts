import { NextResponse, type NextRequest } from "next/server";
import {
  getFeedCategories,
  parseSearchQuery,
  searchCards,
} from "@/lib/public-data";

export async function GET(req: NextRequest) {
  const categories = await getFeedCategories();
  const parsed = parseSearchQuery(req.nextUrl.searchParams, categories);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  return NextResponse.json(await searchCards(parsed.query));
}
