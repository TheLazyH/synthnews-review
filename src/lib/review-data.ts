import { sql } from "@/lib/db";
import type { Progress, ReadItem, ReadList, ReviewItem, StoryItem } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

type Row = Record<string, any>;

function toItem(row: Row): ReviewItem {
  return {
    id: row.id,
    position: row.position,
    payload: row.payload,
    review: row.review_id
      ? {
          relation: row.relation,
          is_opinion: row.is_opinion,
          confidence: row.confidence,
          skipped: row.skipped,
          skip_reason: row.skip_reason,
          note: row.note,
        }
      : null,
  };
}

export async function getList(slug: string) {
  const rows = await sql`
    SELECT id, slug, title, description, guide_md, status, kind
    FROM lists WHERE slug = ${slug}
  `;
  return rows[0] ?? null;
}

export async function getCardLists(): Promise<ReadList[]> {
  const rows = await sql`
    SELECT l.slug, l.title, l.status, count(i.id)::int AS total
    FROM lists l
    LEFT JOIN items i ON i.list_id = l.id
    WHERE l.kind = 'card'
    GROUP BY l.id
    ORDER BY l.slug DESC
  `;
  return rows as ReadList[];
}

export async function getCardItems(listId: string, reviewerId: string): Promise<ReadItem[]> {
  const rows = await sql`
    SELECT i.id, i.payload, c.id AS feedback_id, c.verdict, c.issues, c.bad_sentences,
           c.suggested_title, c.suggested_summary, c.note
    FROM items i
    LEFT JOIN card_reviews c ON c.item_id = i.id AND c.reviewer_id = ${reviewerId}
    WHERE i.list_id = ${listId}
    ORDER BY (i.payload->>'published')::timestamptz DESC, i.position
  `;
  return rows.map((r) => ({
    id: r.id,
    payload: r.payload,
    feedback: r.feedback_id
      ? {
          verdict: r.verdict,
          issues: r.issues,
          bad_sentences: r.bad_sentences,
          suggested_title: r.suggested_title,
          suggested_summary: r.suggested_summary,
          note: r.note,
        }
      : null,
  }));
}

export async function getStoryLists(): Promise<ReadList[]> {
  const rows = await sql`
    SELECT l.slug, l.title, l.status, count(i.id)::int AS total
    FROM lists l
    LEFT JOIN items i ON i.list_id = l.id
    WHERE l.kind = 'story'
    GROUP BY l.id
    ORDER BY l.slug DESC
  `;
  return rows as ReadList[];
}

export async function getStoryItems(listId: string, reviewerId: string): Promise<StoryItem[]> {
  const rows = await sql`
    SELECT i.id, i.payload, s.id AS feedback_id, s.verdict, s.bad_entries, s.note
    FROM items i
    LEFT JOIN story_reviews s ON s.item_id = i.id AND s.reviewer_id = ${reviewerId}
    WHERE i.list_id = ${listId}
    ORDER BY (i.payload->>'last_active')::timestamptz DESC NULLS LAST, i.position
  `;
  return rows.map((r) => ({
    id: r.id,
    payload: r.payload,
    feedback: r.feedback_id
      ? { verdict: r.verdict, bad_entries: r.bad_entries, note: r.note }
      : null,
  }));
}

export async function getProgress(
  listId: string,
  reviewerId: string,
): Promise<Progress> {
  const rows = await sql`
    SELECT count(i.id)::int AS total,
           (count(r.id) FILTER (WHERE NOT r.skipped))::int AS answered,
           (count(r.id) FILTER (WHERE r.skipped))::int AS skipped
    FROM items i
    LEFT JOIN reviews r ON r.item_id = i.id AND r.reviewer_id = ${reviewerId}
    WHERE i.list_id = ${listId}
  `;
  return rows[0] as Progress;
}

export async function nextItem(
  listId: string,
  reviewerId: string,
  mode: "new" | "skipped",
): Promise<ReviewItem | null> {
  const rows =
    mode === "new"
      ? await sql`
          SELECT i.id, i.position, i.payload, NULL AS review_id
          FROM items i
          LEFT JOIN reviews r ON r.item_id = i.id AND r.reviewer_id = ${reviewerId}
          WHERE i.list_id = ${listId} AND r.id IS NULL
          ORDER BY i.position
          LIMIT 1
        `
      : await sql`
          SELECT i.id, i.position, i.payload, r.id AS review_id, r.relation, r.is_opinion,
                 r.confidence, r.skipped, r.skip_reason, r.note
          FROM items i
          JOIN reviews r ON r.item_id = i.id AND r.reviewer_id = ${reviewerId}
          WHERE i.list_id = ${listId} AND r.skipped
          ORDER BY r.updated_at
          LIMIT 1
        `;
  return rows[0] ? toItem(rows[0]) : null;
}

export async function getItem(
  itemId: string,
  reviewerId: string,
): Promise<ReviewItem | null> {
  const rows = await sql`
    SELECT i.id, i.position, i.payload, r.id AS review_id, r.relation, r.is_opinion,
           r.confidence, r.skipped, r.skip_reason, r.note
    FROM items i
    JOIN lists l ON l.id = i.list_id AND l.kind = 'pair'
    LEFT JOIN reviews r ON r.item_id = i.id AND r.reviewer_id = ${reviewerId}
    WHERE i.id = ${itemId}
  `;
  return rows[0] ? toItem(rows[0]) : null;
}
