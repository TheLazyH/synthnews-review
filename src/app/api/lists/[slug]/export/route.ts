import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getList } from "@/lib/review-data";

const HEADER = [
  "pair_id", "position", "a_title", "a_source", "a_url", "b_title", "b_source", "b_url",
  "hours_apart", "relation", "is_opinion", "confidence", "skipped", "skip_reason", "note",
  "time_spent_ms", "reviewed_at", "reviewer_name", "reviewer_email", "list_slug",
];

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await sql`
    SELECT i.external_id, i.position, i.payload, r.relation, r.is_opinion, r.confidence,
           r.skipped, r.skip_reason, r.note, r.time_spent_ms, r.updated_at
    FROM reviews r JOIN items i ON i.id = r.item_id
    WHERE i.list_id = ${list.id} AND r.reviewer_id = ${session.sub}
    ORDER BY i.position
  `;

  const lines = [HEADER.join(",")];
  for (const r of rows) {
    const p = r.payload;
    lines.push(
      [
        r.external_id, r.position, p.a.title, p.a.source, p.a.url, p.b.title, p.b.source, p.b.url,
        p.hours_apart, r.relation, r.is_opinion, r.confidence, r.skipped, r.skip_reason, r.note,
        r.time_spent_ms, new Date(r.updated_at).toISOString(), session.name, session.email, slug,
      ]
        .map(cell)
        .join(","),
    );
  }

  const who = session.email.replace(/[^a-z0-9]+/gi, "_");
  return new Response("\uFEFF" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}_${who}.csv"`,
    },
  });
}