import { cache } from "react";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/review-data";
import type { CardPayload } from "@/lib/types";

export type FeedCard = {
  id: string;
  payload: CardPayload;
  updated: string;
  checking: boolean;
};

export type FeedCursor = { published: string; id: string };

export type FeedPage = { cards: FeedCard[]; next: string | null };

export type StorySource = { source: string; title: string; url: string };

export type StorySegment = {
  id: string;
  headline: string;
  summary: string;
  category: string | null;
  outlets: number;
  sources: StorySource[];
  image: StoryImage | null;
  updated: string;
  checking: boolean;
};

export type StoryImage = { url: string; credit: string };

export type StoryDeckItem = {
  id: string;
  image: StoryImage | null;
  headline: string;
  category: string | null;
  updates: number;
  outlets: number;
  updated: string;
  today: boolean;
  segments: StorySegment[];
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

const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

const SHORT_DAY = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
});

function relativeTime(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return SHORT_DAY.format(new Date(iso));
}

function httpUrl(url: unknown): string | null {
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

function firstImage(p: CardPayload): StoryImage | null {
  const main = httpUrl(p.image?.url);
  if (main && p.image) return { url: main, credit: p.image.credit };
  for (const s of p.sources ?? []) {
    const url = httpUrl(s.image_url);
    if (url) return { url, credit: s.source };
  }
  return null;
}

function publicPayload(p: CardPayload): CardPayload {
  const image = httpUrl(p.image?.url);
  return {
    kind: "card",
    headline: p.headline,
    summary: p.summary,
    sentences: p.sentences,
    category: p.category,
    published: p.published,
    sources: (p.sources ?? []).map((s) => ({
      title: s.title,
      url: s.url,
      source: s.source,
      published: s.published,
      image_url: httpUrl(s.image_url),
    })),
    image: image && p.image ? { url: image, credit: p.image.credit } : null,
  };
}

function outletCount(payloads: CardPayload[]): number {
  return new Set(payloads.flatMap((p) => (p.sources ?? []).map((s) => s.source))).size;
}

type CardRow = {
  id: string;
  payload: CardPayload;
  published: string;
  checking: boolean;
};

function toCard(r: CardRow): FeedCard {
  return {
    id: r.id,
    payload: publicPayload(r.payload),
    updated: formatWhen(r.published),
    checking: r.checking === true,
  };
}

function publicCards() {
  return sql`
    FROM items i
    JOIN lists l ON l.id = i.list_id AND l.kind = 'card'
    WHERE i.hidden_meta->>'card_status' IN ('active', 'needs_review')
  `;
}

function cardColumns() {
  return sql`
    i.id, i.payload,
    (i.hidden_meta->>'card_status' = 'needs_review') AS checking,
    to_char((i.payload->>'published')::timestamptz AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published
  `;
}

function inCategory(category: string | null) {
  return sql`(${category}::text IS NULL OR i.payload->>'category' = ${category}::text)`;
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
    SELECT ${cardColumns()}
    ${publicCards()}
      AND ${inCategory(category)}
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
    ${publicCards()}
      AND i.payload->>'category' IS NOT NULL
    GROUP BY 1
    ORDER BY count(*) DESC, 1
  `;
  return rows.map((r) => r.category as string);
}

export const getPublicCard = cache(
  async (id: string): Promise<FeedCard | null> => {
    if (!isUuid(id)) return null;
    const [row] = await sql`
      SELECT ${cardColumns()}
      ${publicCards()}
        AND i.id = ${id}::uuid
      LIMIT 1
    `;
    return row ? toCard(row as CardRow) : null;
  },
);

export const getStoryDeck = cache(async (): Promise<StoryDeckItem[]> => {
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
      SELECT DISTINCT ON (s.story_id, c.external_id) s.story_id, c.id, c.payload,
             (c.hidden_meta->>'card_status' = 'needs_review') AS checking
      FROM latest s
      CROSS JOIN LATERAL jsonb_array_elements_text(s.card_ids) AS cid
      JOIN items c ON c.external_id = cid
      JOIN lists cl ON cl.id = c.list_id AND cl.kind = 'card'
      WHERE c.hidden_meta->>'card_status' IN ('active', 'needs_review')
      ORDER BY s.story_id, c.external_id, cl.created_at DESC
    )
    SELECT story_id, id, payload, checking,
           to_char((payload->>'published')::timestamptz AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published
    FROM cards
    ORDER BY story_id, (payload->>'published')::timestamptz, id
  `;
  const now = Date.now();
  const today = IST_DAY.format(new Date(now));
  const groups = new Map<string, (CardRow & { story_id: string })[]>();
  for (const r of rows) {
    const list = groups.get(r.story_id) ?? [];
    list.push(r as CardRow & { story_id: string });
    groups.set(r.story_id, list);
  }
  const deck: { item: StoryDeckItem; at: number }[] = [];
  for (const [id, cards] of groups) {
    if (cards.length < 2) continue;
    const payloads = cards.map((c) => c.payload);
    const latest = cards[cards.length - 1];
    const at = new Date(latest.published).getTime();
    deck.push({
      at,
      item: {
        id,
        image: firstImage(latest.payload),
        headline: latest.payload.headline,
        category: latest.payload.category,
        updates: cards.length,
        outlets: outletCount(payloads),
        updated: relativeTime(latest.published, now),
        today: IST_DAY.format(new Date(at)) === today,
        segments: cards.map((c) => ({
          id: c.id,
          headline: c.payload.headline,
          summary: c.payload.summary,
          category: c.payload.category,
          outlets: outletCount([c.payload]),
          sources: (c.payload.sources ?? [])
            .filter((src) => httpUrl(src.url))
            .map((src) => ({ source: src.source, title: src.title, url: src.url })),
          image: firstImage(c.payload),
          updated: relativeTime(c.published, now),
          checking: c.checking === true,
        })),
      },
    });
  }
  return deck.sort((a, b) => b.at - a.at).map((d) => d.item);
});

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
  const top = async () => ({
    page: await getFeed({ cursor: null, category, limit: FEED_PAGE }),
    index: -1,
  });
  if (!cardId) return top();
  const [anchor] = (await sql`
    SELECT ${cardColumns()}
    ${publicCards()}
      AND i.id = ${cardId}::uuid
      AND ${inCategory(category)}
    LIMIT 1
  `) as CardRow[];
  if (!anchor) return top();
  const [newer, older] = await Promise.all([
    sql`
      SELECT ${cardColumns()}
      ${publicCards()}
        AND ${inCategory(category)}
        AND ((i.payload->>'published')::timestamptz, i.id)
            > (${anchor.published}::timestamptz, ${anchor.id}::uuid)
      ORDER BY (i.payload->>'published')::timestamptz ASC, i.id ASC
      LIMIT ${AROUND_MAX}
    `,
    getFeed({
      cursor: { published: anchor.published, id: anchor.id },
      category,
      limit: FEED_PAGE,
    }),
  ]);
  const above = (newer as CardRow[]).reverse().map(toCard);
  return {
    page: {
      cards: [...above, toCard(anchor), ...older.cards],
      next: older.next,
    },
    index: above.length,
  };
}

export const SEARCH_TIMES = ["today", "24h", "7d", "30d", "any"] as const;
export type SearchTime = (typeof SEARCH_TIMES)[number];
export const SEARCH_MIN_OUTLETS = [2, 3, 4] as const;
export type SearchSort = "relevance" | "newest";

const Q_MIN = 3;
const Q_MAX = 100;
const OUTLETS_MAX = 10;
const OUTLET_RE = /^[a-z0-9][a-z0-9.-]{0,99}$/i;
const RANK_RE = /^\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i;
const INTERVALS: Record<string, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

export type SearchCursor = { rank: string | null; published: string; id: string };

export type SearchQuery = {
  q: string | null;
  category: string | null;
  time: SearchTime;
  outlets: string[];
  minOutlets: number | null;
  confirmed: boolean;
  sort: SearchSort;
  limit: number;
  cursor: SearchCursor | null;
};

export type SearchCard = FeedCard & {
  ago: string;
  outlets: number;
  image: StoryImage | null;
};

export type Facet = { key: string; count: number };

export type SearchResult = {
  cards: SearchCard[];
  next: string | null;
  facets: { category: Facet[]; outlet: Facet[] };
};

function encodeSearchCursor(c: SearchCursor): string {
  const base = encodeCursor({ published: c.published, id: c.id });
  return c.rank === null ? base : `${c.rank}_${base}`;
}

function decodeSearchCursor(raw: string, sort: SearchSort): SearchCursor | null {
  if (sort === "newest") {
    const c = decodeCursor(raw);
    return c && { rank: null, ...c };
  }
  const cut = raw.indexOf("_");
  if (cut < 1) return null;
  const rank = raw.slice(0, cut);
  if (rank.length > 32 || !RANK_RE.test(rank)) return null;
  const c = decodeCursor(raw.slice(cut + 1));
  return c && { rank, ...c };
}

export function parseSearchQuery(
  params: URLSearchParams,
  categories: string[],
): { query: SearchQuery } | { error: string } {
  const q = (params.get("q") ?? "").trim();
  if (q.length > Q_MAX) return { error: "bad_q" };
  if (q && q.length < Q_MIN) return { error: "short_query" };

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
    if (!CATEGORY_RE.test(rawCategory) || !categories.includes(rawCategory))
      return { error: "bad_category" };
    category = rawCategory;
  }

  const rawTime = params.get("time") ?? "any";
  if (!(SEARCH_TIMES as readonly string[]).includes(rawTime))
    return { error: "bad_time" };
  const time = rawTime as SearchTime;

  const rawOutlets = params.getAll("outlet");
  if (rawOutlets.length > OUTLETS_MAX) return { error: "bad_outlet" };
  if (rawOutlets.some((o) => !OUTLET_RE.test(o))) return { error: "bad_outlet" };
  const outlets = [...new Set(rawOutlets.map((o) => o.toLowerCase()))];

  const rawMin = params.get("min_outlets");
  let minOutlets: number | null = null;
  if (rawMin) {
    if (!(SEARCH_MIN_OUTLETS as readonly number[]).map(String).includes(rawMin))
      return { error: "bad_min_outlets" };
    minOutlets = Number(rawMin);
  }

  const rawConfirmed = params.get("confirmed");
  if (rawConfirmed !== null && rawConfirmed !== "true" && rawConfirmed !== "false")
    return { error: "bad_confirmed" };
  const confirmed = rawConfirmed === "true";

  const rawSort = params.get("sort");
  if (rawSort !== null && rawSort !== "relevance" && rawSort !== "newest")
    return { error: "bad_sort" };
  const sort: SearchSort = q ? (rawSort ?? "relevance") : "newest";

  if (
    !q &&
    !category &&
    time === "any" &&
    !outlets.length &&
    !minOutlets &&
    !confirmed
  )
    return { error: "empty_query" };

  const rawCursor = params.get("cursor");
  let cursor: SearchCursor | null = null;
  if (rawCursor) {
    cursor = decodeSearchCursor(rawCursor, sort);
    if (!cursor) return { error: "bad_cursor" };
  }

  return {
    query: {
      q: q || null,
      category,
      time,
      outlets,
      minOutlets,
      confirmed,
      sort,
      limit,
      cursor,
    },
  };
}

function cardDocument() {
  return sql`to_tsvector('english',
    coalesce(i.payload->>'headline', '') || ' ' || coalesce(i.payload->>'summary', ''))`;
}

function matchedCards(query: SearchQuery) {
  const { q, time, minOutlets, confirmed } = query;
  return sql`
    SELECT ${cardColumns()},
           i.payload->>'category' AS category,
           (i.payload->>'published')::timestamptz AS at,
           ${q ? sql`ts_rank(${cardDocument()}, websearch_to_tsquery('english', ${q}))` : sql`0::real`} AS rank
    ${publicCards()}
      ${q ? sql`AND ${cardDocument()} @@ websearch_to_tsquery('english', ${q})` : sql``}
      ${
        time === "today"
          ? sql`AND (i.payload->>'published')::timestamptz
                >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`
          : time === "any"
            ? sql``
            : sql`AND (i.payload->>'published')::timestamptz >= now() - ${INTERVALS[time]}::interval`
      }
      ${confirmed ? sql`AND i.hidden_meta->>'card_status' = 'active'` : sql``}
      ${
        minOutlets
          ? sql`AND (SELECT count(DISTINCT v #>> '{}')
                     FROM jsonb_path_query(i.payload, '$.sources[*].source') v) >= ${minOutlets}::int`
          : sql``
      }
  `;
}

function outletFilter(outlets: string[]) {
  return outlets.length
    ? sql`EXISTS (SELECT 1 FROM jsonb_path_query(m.payload, '$.sources[*].source') v
                  WHERE lower(v #>> '{}') = ANY(${outlets}::text[]))`
    : sql`TRUE`;
}

function categoryFilter(category: string | null) {
  return sql`(${category}::text IS NULL OR m.category = ${category}::text)`;
}

export async function searchCards(query: SearchQuery): Promise<SearchResult> {
  const { category, outlets, sort, limit, cursor } = query;
  const after = !cursor
    ? sql`TRUE`
    : sort === "relevance"
      ? sql`(m.rank, m.at, m.id) < (${cursor.rank}::real, ${cursor.published}::timestamptz, ${cursor.id}::uuid)`
      : sql`(m.at, m.id) < (${cursor.published}::timestamptz, ${cursor.id}::uuid)`;
  const order =
    sort === "relevance"
      ? sql`m.rank DESC, m.at DESC, m.id DESC`
      : sql`m.at DESC, m.id DESC`;
  const [rows, facets] = await Promise.all([
    sql`
      WITH m AS (${matchedCards(query)})
      SELECT m.id, m.payload, m.checking, m.published, m.rank::text AS rank
      FROM m
      WHERE ${categoryFilter(category)} AND ${outletFilter(outlets)} AND ${after}
      ORDER BY ${order}
      LIMIT ${limit + 1}
    `,
    sql`
      WITH m AS (${matchedCards(query)})
      (SELECT 'category' AS facet, m.category AS key, count(*)::int AS count
       FROM m
       WHERE m.category IS NOT NULL AND ${outletFilter(outlets)}
       GROUP BY m.category)
      UNION ALL
      (SELECT 'outlet', o.key, count(*)::int
       FROM m
       CROSS JOIN LATERAL (
         SELECT DISTINCT lower(v #>> '{}') AS key
         FROM jsonb_path_query(m.payload, '$.sources[*].source') v
       ) o
       WHERE ${categoryFilter(category)}
       GROUP BY o.key
       ORDER BY 3 DESC, 2
       LIMIT 30)
    `,
  ]);
  const now = Date.now();
  const page = rows.slice(0, limit) as (CardRow & { rank: string })[];
  const last = page[page.length - 1];
  const facetList = (name: string) =>
    facets
      .filter((f) => f.facet === name)
      .map((f) => ({ key: f.key as string, count: f.count as number }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return {
    cards: page.map((r) => ({
      ...toCard(r),
      ago: relativeTime(r.published, now),
      outlets: outletCount([r.payload]),
      image: firstImage(r.payload),
    })),
    next:
      rows.length > limit && last
        ? encodeSearchCursor({
            rank: sort === "relevance" ? last.rank : null,
            published: last.published,
            id: last.id,
          })
        : null,
    facets: { category: facetList("category"), outlet: facetList("outlet") },
  };
}
