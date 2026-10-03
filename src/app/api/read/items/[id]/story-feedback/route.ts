import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/review-data";
import type { MyStoryFeedback, StoryVerdict } from "@/lib/types";

const VERDICTS = new Set<string>([
  "good",
  "wrong_link",
  "series_not_story",
  "missing_link",
]);
const MAX_NOTE = 1000;
const MAX_TIME_MS = 60 * 60 * 1000;

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("invalid_body");

  const verdict = String(body.verdict ?? "");
  if (!VERDICTS.has(verdict)) return bad("invalid_verdict");

  const rawEntries: unknown[] = Array.isArray(body.bad_entries)
    ? body.bad_entries
    : [];
  if (!rawEntries.every((n) => Number.isInteger(n) && (n as number) >= 0)) {
    return bad("invalid_entries");
  }
  const badEntries = [...new Set(rawEntries as number[])].sort((a, b) => a - b);

  const rows = await sql`
    SELECT l.status, l.kind, jsonb_array_length(i.payload->'timeline') AS entries
    FROM items i JOIN lists l ON l.id = i.list_id
    WHERE i.id = ${id}
  `;
  const item = rows[0];
  if (!item || item.kind !== "story")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (item.status !== "open")
    return NextResponse.json({ error: "list_closed" }, { status: 409 });
  if (badEntries.some((n) => n >= (item.entries ?? 0)))
    return bad("invalid_entries");

  const note = clean(body.note)?.slice(0, MAX_NOTE) ?? null;
  if (verdict === "wrong_link" && badEntries.length === 0)
    return bad("entries_required");
  if (verdict !== "wrong_link" && badEntries.length > 0)
    return bad("entries_need_wrong_link");
  if (verdict === "missing_link" && !note) return bad("note_required");

  const timeSpent = Number.isFinite(body.time_spent_ms)
    ? Math.max(0, Math.min(Math.round(body.time_spent_ms), MAX_TIME_MS))
    : null;

  await sql`
    INSERT INTO story_reviews (item_id, reviewer_id, verdict, bad_entries, note, time_spent_ms)
    VALUES (${id}, ${session.sub}, ${verdict}, ${badEntries}::int[], ${note}, ${timeSpent})
    ON CONFLICT (item_id, reviewer_id) DO UPDATE SET
      verdict = EXCLUDED.verdict,
      bad_entries = EXCLUDED.bad_entries,
      note = EXCLUDED.note,
      time_spent_ms = coalesce(story_reviews.time_spent_ms, 0) + coalesce(EXCLUDED.time_spent_ms, 0),
      updated_at = now()
  `;

  const feedback: MyStoryFeedback = {
    verdict: verdict as StoryVerdict,
    bad_entries: badEntries,
    note,
  };
  return NextResponse.json({ ok: true, feedback });
}
