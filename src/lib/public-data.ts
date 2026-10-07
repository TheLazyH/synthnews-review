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
           (i.hidden_meta->>'card_status' = 'needs_review') AS checking,
           to_char((i.payload->>'published')::timestamptz AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published
    FROM items i
    JOIN lists l ON l.id = i.list_id AND l.kind = 'card'
    WHERE i.hidden_meta->>'card_status' IN ('active', 'needs_review')
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
    WHERE i.hidden_meta->>'card_status' IN ('active', 'needs_review')
      AND i.payload->>'category' IS NOT NULL
    GROUP BY 1
    ORDER BY count(*) DESC, 1
  `;
  return rows.map((r) => r.category as string);
}

export async function getStoryDeck(): Promise<StoryDeckItem[]> {
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
