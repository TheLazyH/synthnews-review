import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/review-data";
import type { CardIssue, CardVerdict, MyFeedback } from "@/lib/types";

const VERDICTS = new Set<string>(["good", "needs_fix", "wrong"]);
const ISSUES = new Set<string>([
  "not_in_sources",
  "mixed_events",
  "copied",
  "bad_headline",
]);
const MAX_NOTE = 1000;
const MAX_TITLE = 255;
const MAX_SUMMARY = 2000;
const MAX_TIME_MS = 60 * 60 * 1000;

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function same(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ") === b.replace(/\s+/g, " ");
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

  const rawIssues: unknown[] = Array.isArray(body.issues) ? body.issues : [];
  if (!rawIssues.every((i) => typeof i === "string" && ISSUES.has(i)))
    return bad("invalid_issues");
  const issues = [...new Set(rawIssues as CardIssue[])];

  const rawSentences: unknown[] = Array.isArray(body.bad_sentences)
    ? body.bad_sentences
    : [];
  if (!rawSentences.every((n) => Number.isInteger(n) && (n as number) >= 0)) {
    return bad("invalid_sentences");
  }
  const badSentences = [...new Set(rawSentences as number[])].sort(
    (a, b) => a - b,
  );

  const rows = await sql`
    SELECT l.status, l.kind, i.payload->>'headline' AS headline, i.payload->'sentences' AS sentences
    FROM items i JOIN lists l ON l.id = i.list_id
    WHERE i.id = ${id}
  `;
  const item = rows[0];
  if (!item || item.kind !== "card")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (item.status !== "open")
    return NextResponse.json({ error: "list_closed" }, { status: 409 });

  const sentences: string[] = item.sentences ?? [];
  if (badSentences.some((n) => n >= sentences.length))
    return bad("invalid_sentences");

  let suggestedTitle = clean(body.suggested_title);
  let suggestedSummary = clean(body.suggested_summary);
  if (suggestedTitle && same(suggestedTitle, item.headline ?? ""))
    suggestedTitle = null;
  if (suggestedSummary && same(suggestedSummary, sentences.join(" ")))
    suggestedSummary = null;
  if (suggestedTitle && suggestedTitle.length > MAX_TITLE)
    return bad("title_too_long");
  if (suggestedSummary && suggestedSummary.length > MAX_SUMMARY)
    return bad("summary_too_long");

  if (
    verdict === "good" &&
    (issues.length || badSentences.length || suggestedTitle || suggestedSummary)
  ) {
    return bad("good_has_details");
  }
  if (verdict !== "good" && issues.length === 0) return bad("issue_required");
  if (badSentences.length && !issues.includes("not_in_sources"))
    return bad("sentences_need_not_in_sources");
  if ((suggestedTitle || suggestedSummary) && verdict !== "needs_fix")
    return bad("suggestion_needs_fix");

  const note = clean(body.note)?.slice(0, MAX_NOTE) ?? null;
  const timeSpent = Number.isFinite(body.time_spent_ms)
    ? Math.max(0, Math.min(Math.round(body.time_spent_ms), MAX_TIME_MS))
    : null;

  await sql`
    INSERT INTO card_reviews (item_id, reviewer_id, verdict, issues, bad_sentences,
                              suggested_title, suggested_summary, note, time_spent_ms)
    VALUES (${id}, ${session.sub}, ${verdict}, ${issues}::text[], ${badSentences}::int[],
            ${suggestedTitle}, ${suggestedSummary}, ${note}, ${timeSpent})
    ON CONFLICT (item_id, reviewer_id) DO UPDATE SET
      verdict = EXCLUDED.verdict,
      issues = EXCLUDED.issues,
      bad_sentences = EXCLUDED.bad_sentences,
      suggested_title = EXCLUDED.suggested_title,
      suggested_summary = EXCLUDED.suggested_summary,
      note = EXCLUDED.note,
      time_spent_ms = coalesce(card_reviews.time_spent_ms, 0) + coalesce(EXCLUDED.time_spent_ms, 0),
      updated_at = now()
  `;

  const feedback: MyFeedback = {
    verdict: verdict as CardVerdict,
    issues,
    bad_sentences: badSentences,
    suggested_title: suggestedTitle,
    suggested_summary: suggestedSummary,
    note,
  };
  return NextResponse.json({ ok: true, feedback });
}
