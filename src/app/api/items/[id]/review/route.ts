import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/review-data";

const RELATIONS = new Set(["same_event", "same_story", "unrelated"]);
const CONFIDENCE = new Set(["sure", "not_sure"]);
const SKIP_REASONS = new Set(["need_context", "article_broken", "other"]);
const MAX_NOTE = 1000;
const MAX_TIME_MS = 60 * 60 * 1000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const skipped = body.skipped === true;
  const relation = skipped ? null : String(body.relation ?? "");
  const confidence = skipped ? null : String(body.confidence ?? "");
  const skipReason = skipped ? String(body.skip_reason ?? "") : null;
  if (!skipped && (!RELATIONS.has(relation!) || !CONFIDENCE.has(confidence!))) {
    return NextResponse.json({ error: "invalid_review" }, { status: 400 });
  }
  if (skipped && !SKIP_REASONS.has(skipReason!)) {
    return NextResponse.json({ error: "invalid_skip_reason" }, { status: 400 });
  }
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE) : null;
  const isOpinion = body.is_opinion === true;
  const timeSpent = Number.isFinite(body.time_spent_ms)
    ? Math.max(0, Math.min(Math.round(body.time_spent_ms), MAX_TIME_MS))
    : null;

  const lists = await sql`
    SELECT l.status, l.kind FROM items i JOIN lists l ON l.id = i.list_id WHERE i.id = ${id}
  `;
  if (!lists[0] || lists[0].kind !== "pair") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (lists[0].status !== "open") return NextResponse.json({ error: "list_closed" }, { status: 409 });

  await sql`
    INSERT INTO reviews (item_id, reviewer_id, relation, is_opinion, confidence,
                         skipped, skip_reason, note, time_spent_ms)
    VALUES (${id}, ${session.sub}, ${relation}, ${isOpinion}, ${confidence},
            ${skipped}, ${skipReason}, ${note}, ${timeSpent})
    ON CONFLICT (item_id, reviewer_id) DO UPDATE SET
      relation = EXCLUDED.relation,
      is_opinion = EXCLUDED.is_opinion,
      confidence = EXCLUDED.confidence,
      skipped = EXCLUDED.skipped,
      skip_reason = EXCLUDED.skip_reason,
      note = EXCLUDED.note,
      time_spent_ms = coalesce(reviews.time_spent_ms, 0) + coalesce(EXCLUDED.time_spent_ms, 0),
      updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}