import { sql } from "@/lib/db";
import { isUuid } from "@/lib/review-data";
import type { CardPayload } from "@/lib/types";

export type FeedCard = { id: string; payload: CardPayload; updated: string };

export type FeedCursor = { published: string; id: string };

export type FeedPage = { cards: FeedCard[]; next: string | null };

export type StorySummary = {
  id: string;
  headline: string;
  category: string | null;
  updates: number;
  lastUpdated: string;
};

const WHEN = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatWhen(iso: string): string {
  return WHEN.format(new Date(iso));
}

export function encodeCursor(c: FeedCursor): string {
  return `${c.published}_${c.id}`;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export function decodeCursor(raw: string): FeedCursor | null {
  const [published, id, ...rest] = raw.split("_");
  if (rest.length || !published || !id) return null;
  if (!ISO_RE.test(published)) return null;
  const date = new Date(published);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString() !== `${published.slice(0, 23)}Z`) return null;
  if (!isUuid(id)) return null;
  return { published, id };
}

type CardRow = { id: string; payload: CardPayload; published: string };

function toCard(r: CardRow): FeedCard {
  return { id: r.id, payload: r.payload, updated: formatWhen(r.published) };
}

export async function getFeed({
  cursor,
  category,
  limit,
}: {
  cursor: FeedCursor | null;
  category: string | null;
  limit: number;
}): Promise<FeedPage> {
  const rows = await sql`
    SELECT i.id, i.payload,
           to_char((i.payload->>'published')::timestamptz AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published
    FROM items i
    JOIN lists l ON l.id = i.list_id AND l.kind = 'card'
    WHERE i.hidden_meta->>'card_status' = 'active'
      AND (${category}::text IS NULL OR i.payload->>'category' = ${category}::text)
      AND (${cursor?.published ?? null}::timestamptz IS NULL
           OR ((i.payload->>'published')::timestamptz, i.id)
              < (${cursor?.published ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
    ORDER BY (i.payload->>'published')::timestamptz DESC, i.id DESC
    LIMIT ${limit + 1}
  `;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    cards: page.map((r) => toCard(r as CardRow)),
    next:
      rows.length > limit && last
        ? encodeCursor({ published: last.published, id: last.id })
        : null,
  };
}

export async function getFeedCategories(): Promise<string[]> {
  const rows = await sql`
    SELECT i.payload->>'category' AS category
    FROM items i
    JOIN lists l ON l.id = i.list_id AND l.kind = 'card'
    WHERE i.hidden_meta->>'card_status' = 'active'
      AND i.payload->>'category' IS NOT NULL
    GROUP BY 1
    ORDER BY count(*) DESC, 1
  `;
  return rows.map((r) => r.category as string);
}

export async function getStories(): Promise<StorySummary[]> {
  const rows = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (i.hidden_meta->>'story_id')
             i.hidden_meta->>'story_id' AS story_id,
             i.hidden_meta->'card_ids' AS card_ids
      FROM items i
      JOIN lists l ON l.id = i.list_id AND l.kind = 'story'
      ORDER BY i.hidden_meta->>'story_id', l.created_at DESC, l.slug DESC
    ),
    cards AS (
      SELECT DISTINCT ON (s.story_id, c.external_id) s.story_id, c.payload
      FROM latest s
      CROSS JOIN LATERAL jsonb_array_elements_text(s.card_ids) AS cid
      JOIN items c ON c.external_id = cid
      JOIN lists cl ON cl.id = c.list_id AND cl.kind = 'card'
      WHERE c.hidden_meta->>'card_status' = 'active'
      ORDER BY s.story_id, c.external_id, cl.created_at DESC
    )
    SELECT story_id,
           count(*)::int AS updates,
           (array_agg(payload->>'headline'
              ORDER BY (payload->>'published')::timestamptz DESC))[1] AS headline,
           (array_agg(payload->>'category'
              ORDER BY (payload->>'published')::timestamptz DESC))[1] AS category,
           to_char(max((payload->>'published')::timestamptz) AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS last_updated
    FROM cards
    GROUP BY story_id
    HAVING count(*) >= 2
    ORDER BY max((payload->>'published')::timestamptz) DESC
  `;
  return rows.map((r) => ({
    id: r.story_id,
    headline: r.headline,
    category: r.category,
    updates: r.updates,
    lastUpdated: formatWhen(r.last_updated),
  }));
}

export async function getStoryCards(storyId: string): Promise<FeedCard[] | null> {
  if (!isUuid(storyId)) return null;
  const rows = await sql`
    WITH latest AS (
      SELECT i.hidden_meta->'card_ids' AS card_ids
      FROM items i
      JOIN lists l ON l.id = i.list_id AND l.kind = 'story'
      WHERE i.hidden_meta->>'story_id' = ${storyId}
      ORDER BY l.created_at DESC, l.slug DESC
      LIMIT 1
    ),
    cards AS (
      SELECT DISTINCT ON (c.external_id) c.id, c.payload
      FROM latest s
      CROSS JOIN LATERAL jsonb_array_elements_text(s.card_ids) AS cid
      JOIN items c ON c.external_id = cid
      JOIN lists cl ON cl.id = c.list_id AND cl.kind = 'card'
      WHERE c.hidden_meta->>'card_status' = 'active'
      ORDER BY c.external_id, cl.created_at DESC
    )
    SELECT id, payload,
           to_char((payload->>'published')::timestamptz AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published
    FROM cards
    ORDER BY (payload->>'published')::timestamptz DESC, id DESC
  `;
  return rows.length >= 2 ? rows.map((r) => toCard(r as CardRow)) : null;
}

export const FEED_PAGE = 20;
const FEED_MAX = 50;
const CATEGORY_RE = /^[a-z0-9][a-z0-9 &_-]{0,39}$/i;

export type FeedQuery = {
  cursor: FeedCursor | null;
  category: string | null;
  limit: number;
};

export function parseFeedQuery(
  params: URLSearchParams,
): { query: FeedQuery } | { error: string } {
  const rawLimit = params.get("limit");
  let limit = FEED_PAGE;
  if (rawLimit !== null) {
    if (!/^\d{1,4}$/.test(rawLimit) || Number(rawLimit) < 1)
      return { error: "bad_limit" };
    limit = Math.min(Number(rawLimit), FEED_MAX);
  }
  const rawCategory = params.get("category");
  let category: string | null = null;
  if (rawCategory) {
    if (!CATEGORY_RE.test(rawCategory)) return { error: "bad_category" };
    category = rawCategory;
  }
  const rawCursor = params.get("cursor");
  let cursor: FeedCursor | null = null;
  if (rawCursor) {
    cursor = decodeCursor(rawCursor);
    if (!cursor) return { error: "bad_cursor" };
  }
  return { query: { cursor, category, limit } };
}

const AROUND_MAX = 200;

export async function getFeedAround({
  category,
  cardId,
}: {
  category: string | null;
  cardId: string | null;
}): Promise<{ page: FeedPage; index: number }> {
  if (!cardId) {
    return {
      page: await getFeed({ cursor: null, category, limit: FEED_PAGE }),
      index: -1,
    };
  }
  const probe = await getFeed({ cursor: null, category, limit: AROUND_MAX });
  const index = probe.cards.findIndex((c) => c.id === cardId);
  const keep =
    index < 0 ? FEED_PAGE : Math.ceil((index + 1) / FEED_PAGE) * FEED_PAGE;
  const page =
    !probe.next && keep >= probe.cards.length
      ? probe
      : await getFeed({ cursor: null, category, limit: keep });
  return { page, index };
}
