import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getList, getProgress, nextItem } from "@/lib/review-data";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const list = await getList(slug);
  if (!list || list.kind !== "pair") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const mode = new URL(req.url).searchParams.get("mode") === "skipped" ? "skipped" : "new";
  const [item, progress] = await Promise.all([
    nextItem(list.id, session.sub, mode),
    getProgress(list.id, session.sub),
  ]);
  return NextResponse.json({ item, progress });
}