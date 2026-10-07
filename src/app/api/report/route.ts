import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/review-data";

const REASONS = new Set<string>([
  "wrong_fact",
  "missing_context",
  "outdated",
  "other",
]);
const MAX_BODY_BYTES = 2048;
const MAX_NOTE = 280;
const VISITOR_PER_HOUR = 20;
const GLOBAL_PER_HOUR = 1000;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "";
}

export async function POST(req: NextRequest) {
  const salt = process.env.REPORT_SALT;
  if (!salt) return fail("unavailable", 503);

  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) return fail("invalid_content_type");
  if (!sameOrigin(req)) return fail("invalid_origin");

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("too_large");
  const raw = await req.text().catch(() => null);
  if (raw === null || Buffer.byteLength(raw) > MAX_BODY_BYTES)
    return fail("too_large");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("invalid_body");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return fail("invalid_body");
  const input = body as Record<string, unknown>;

  if (input.hp !== undefined && input.hp !== null && input.hp !== "")
    return fail("invalid_body");

  const cardId = input.card_id;
  if (typeof cardId !== "string" || !isUuid(cardId)) return fail("invalid_card");

  const reason = input.reason;
  if (typeof reason !== "string" || !REASONS.has(reason))
    return fail("invalid_reason");

  let note: string | null = null;
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== "string") return fail("invalid_note");
    const trimmed = input.note.trim();
    if ([...trimmed].length > MAX_NOTE) return fail("invalid_note");
    note = trimmed || null;
  }

  const visitor = createHmac("sha256", salt)
    .update(`${clientIp(req)}\n${req.headers.get("user-agent") ?? ""}`)
    .digest("hex");

  const [counts] = await sql`
    SELECT (count(*) FILTER (WHERE visitor_hash = ${visitor}))::int AS mine,
           count(*)::int AS total
    FROM card_reports
    WHERE created_at > now() - interval '1 hour'
  `;
  if (counts.mine >= VISITOR_PER_HOUR || counts.total >= GLOBAL_PER_HOUR)
    return fail("rate_limited", 429);

  const inserted = await sql`
    INSERT INTO card_reports (card_id, reason, note, visitor_hash)
    SELECT i.id, ${reason}, ${note}, ${visitor}
    FROM items i
    JOIN lists l ON l.id = i.list_id AND l.kind = 'card'
    WHERE i.id = ${cardId}
      AND i.hidden_meta->>'card_status' IN ('active', 'needs_review')
    RETURNING id
  `;
  if (inserted.length === 0) return fail("invalid_card");

  return NextResponse.json({ ok: true }, { status: 202 });
}
