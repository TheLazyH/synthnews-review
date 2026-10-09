"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/global-loader";
import StoryThumb from "@/app/stories/story-thumb";
import type {
  Facet,
  SearchCard,
  SearchResult,
  SearchSort,
  SearchTime,
} from "@/lib/public-data";

export type SearchState = {
  q: string;
  category: string;
  time: SearchTime;
  outlets: string[];
  minOutlets: number | null;
  confirmed: boolean;
  sort: SearchSort | "";
};

type Filters = Omit<SearchState, "q">;

type Loaded =
  | { key: string; ok: true; cards: SearchCard[]; next: string | null; facets: SearchResult["facets"] }
  | { key: string; ok: false };

type Sheet = "category" | "time" | "outlet" | "reported" | "sort" | null;

const DEBOUNCE_MS = 300;
const Q_MIN = 3;

const TIME_LABELS: Record<SearchTime, string> = {
  today: "Today",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  any: "Any time",
};

const NO_FILTERS: Filters = {
  category: "",
  time: "any",
  outlets: [],
  minOutlets: null,
  confirmed: false,
  sort: "",
};

function hasFilters(f: Filters) {
  return (
    !!f.category ||
    f.time !== "any" ||
    f.outlets.length > 0 ||
    f.minOutlets !== null ||
    f.confirmed
  );
}

function toParams(q: string, f: Filters) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (f.category) params.set("category", f.category);
  if (f.time !== "any") params.set("time", f.time);
  for (const o of f.outlets) params.append("outlet", o);
  if (f.minOutlets) params.set("min_outlets", String(f.minOutlets));
  if (f.confirmed) params.set("confirmed", "true");
  if (q && f.sort) params.set("sort", f.sort);
  return params;
}

async function fetchSearch(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<SearchResult | null> {
  const res = await fetch(`/api/search?${params}`, { signal }).catch(() => null);
  return res?.ok ? res.json() : null;
}

function countOf(facets: Facet[] | undefined, key: string) {
  return facets?.find((f) => f.key === key)?.count;
}

export default function SearchView({
  categories,
  initial,
}: {
  categories: string[];
  initial: SearchState;
}) {
  const [q, setQ] = useState(initial.q);
  const [debounced, setDebounced] = useState(initial.q.trim());
  const [filters, setFilters] = useState<Filters>({
    category: initial.category,
    time: initial.time,
    outlets: initial.outlets,
    minOutlets: initial.minOutlets,
    confirmed: initial.confirmed,
    sort: initial.sort,
  });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [more, setMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const params = toParams(debounced, filters);
  const key = params.toString();
  const short = debounced.length > 0 && debounced.length < Q_MIN;
  const typingShort = q.trim().length > 0 && q.trim().length < Q_MIN;
  const active = !short && (!!debounced || hasFilters(filters));

  useEffect(() => {
    window.history.replaceState(null, "", key ? `/search?${key}` : "/search");
    if (!active) return;
    const controller = new AbortController();
    fetchSearch(new URLSearchParams(key), controller.signal).then((r) => {
      if (controller.signal.aborted) return;
      setMoreFailed(false);
      setLoaded(r ? { key, ok: true, ...r } : { key, ok: false });
    });
    return () => controller.abort();
  }, [key, active]);

  const current = loaded?.key === key ? loaded : null;
  const result = current?.ok ? current : null;
  const facets = result?.facets;

  function update(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  async function loadMore() {
    if (!result?.next || more) return;
    const next = new URLSearchParams(key);
    next.set("cursor", result.next);
    setMore(true);
    setMoreFailed(false);
    const page = await fetchSearch(next);
    setMore(false);
    if (!page) {
      setMoreFailed(true);
      return;
    }
    setLoaded((prev) =>
      prev?.key === key && prev.ok
        ? { ...prev, cards: [...prev.cards, ...page.cards], next: page.next }
        : prev,
    );
  }

  const outletKeys = [
    ...new Set([...(facets?.outlet ?? []).map((f) => f.key), ...filters.outlets]),
  ];
  const sortValue: SearchSort = debounced ? filters.sort || "relevance" : "newest";

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24 md:p-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setDebounced(q.trim());
        }}
        className="relative"
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          maxLength={100}
          enterKeyHint="search"
          placeholder="Search headlines and summaries"
          aria-label="Search news"
          className="h-12 w-full rounded-full border bg-background pl-11 pr-11 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDebounced("");
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 hover:bg-muted"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
        <Chip
          label={filters.category || "Category"}
          on={!!filters.category}
          onClick={() => setSheet("category")}
        />
        <Chip
          label={filters.time === "any" ? "Time" : TIME_LABELS[filters.time]}
          on={filters.time !== "any"}
          onClick={() => setSheet("time")}
        />
        <Chip
          label={
            filters.outlets.length === 0
              ? "Outlet"
              : filters.outlets.length === 1
                ? filters.outlets[0]
                : `${filters.outlets.length} outlets`
          }
          on={filters.outlets.length > 0}
          onClick={() => setSheet("outlet")}
        />
        <Chip
          label={filters.minOutlets ? `${filters.minOutlets}+ outlets` : "Reported by"}
          on={filters.minOutlets !== null}
          onClick={() => setSheet("reported")}
        />
        <Button
          type="button"
          size="sm"
          variant={filters.confirmed ? "default" : "outline"}
          aria-pressed={filters.confirmed}
          onClick={() => update({ confirmed: !filters.confirmed })}
          className="shrink-0 rounded-full"
        >
          Confirmed only
        </Button>
        <Chip
          label={sortValue === "relevance" ? "Most relevant" : "Newest"}
          on={false}
          onClick={() => setSheet("sort")}
        />
        {hasFilters(filters) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setFilters({ ...NO_FILTERS, sort: filters.sort })}
            className="shrink-0 rounded-full"
          >
            Clear filters
          </Button>
        )}
      </div>

      {typingShort ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Type at least 3 characters
        </p>
      ) : !active ? (
        <div className="space-y-1 py-12 text-center">
          <p className="font-semibold">Search the news</p>
          <p className="text-sm text-muted-foreground">
            Type a few words, or pick a filter to browse.
          </p>
        </div>
      ) : !current ? (
        <PageLoader />
      ) : !result ? (
        <div className="flex items-center justify-center gap-3 py-12 text-sm">
          <span className="text-red-600">Couldn&apos;t load results.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLoaded(null)}
          >
            Try again
          </Button>
        </div>
      ) : result.cards.length === 0 ? (
        <div className="space-y-3 py-12 text-center">
          <p className="font-semibold">No results</p>
          <p className="text-sm text-muted-foreground">
            Try different words{hasFilters(filters) ? " or fewer filters" : ""}.
          </p>
          {hasFilters(filters) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFilters({ ...NO_FILTERS, sort: filters.sort })}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y">
            {result.cards.map((c) => (
              <ResultRow key={c.id} card={c} />
            ))}
          </ul>
          {result.next && (
            <div className="flex flex-col items-center gap-2">
              {moreFailed && (
                <span className="text-sm text-red-600">Couldn&apos;t load more.</span>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={more}
                onClick={loadMore}
              >
                {more ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      {sheet === "category" && (
        <FilterSheet title="Category" onClose={() => setSheet(null)}>
          {["", ...categories].map((c) => (
            <Option
              key={c || "any"}
              label={c || "Any category"}
              count={c ? (countOf(facets?.category, c) ?? (facets ? 0 : undefined)) : undefined}
              selected={filters.category === c}
              onClick={() => {
                update({ category: c });
                setSheet(null);
              }}
            />
          ))}
        </FilterSheet>
      )}

      {sheet === "time" && (
        <FilterSheet title="Time" onClose={() => setSheet(null)}>
          {(Object.keys(TIME_LABELS) as SearchTime[]).map((t) => (
            <Option
              key={t}
              label={TIME_LABELS[t]}
              selected={filters.time === t}
              onClick={() => {
                update({ time: t });
                setSheet(null);
              }}
            />
          ))}
        </FilterSheet>
      )}

      {sheet === "outlet" && (
        <FilterSheet title="Outlet" onClose={() => setSheet(null)}>
          {outletKeys.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">
              Search or pick a filter to see outlets.
            </p>
          )}
          {outletKeys.map((o) => {
            const on = filters.outlets.includes(o);
            return (
              <Option
                key={o}
                label={o}
                count={countOf(facets?.outlet, o) ?? (facets ? 0 : undefined)}
                selected={on}
                multi
                onClick={() =>
                  update({
                    outlets: on
                      ? filters.outlets.filter((x) => x !== o)
                      : [...filters.outlets, o].slice(0, 10),
                  })
                }
              />
            );
          })}
          {filters.outlets.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => update({ outlets: [] })}
            >
              Any outlet
            </Button>
          )}
        </FilterSheet>
      )}

      {sheet === "reported" && (
        <FilterSheet title="Reported by" onClose={() => setSheet(null)}>
          {[null, 2, 3, 4].map((n) => (
            <Option
              key={n ?? "any"}
              label={n ? `${n}+ outlets` : "Any number of outlets"}
              selected={filters.minOutlets === n}
              onClick={() => {
                update({ minOutlets: n });
                setSheet(null);
              }}
            />
          ))}
        </FilterSheet>
      )}

      {sheet === "sort" && (
        <FilterSheet title="Sort" onClose={() => setSheet(null)}>
          <Option
            label="Most relevant"
            selected={sortValue === "relevance"}
            disabled={!debounced}
            onClick={() => {
              update({ sort: "relevance" });
              setSheet(null);
            }}
          />
          <Option
            label="Newest"
            selected={sortValue === "newest"}
            onClick={() => {
              update({ sort: "newest" });
              setSheet(null);
            }}
          />
          {!debounced && (
            <p className="pt-2 text-xs text-muted-foreground">
              Relevance needs search words.
            </p>
          )}
        </FilterSheet>
      )}
    </main>
  );
}

function Chip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={on ? "default" : "outline"}
      aria-haspopup="dialog"
      onClick={onClick}
      className="shrink-0 gap-1 rounded-full capitalize"
    >
      {label}
      <ChevronDown className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function FilterSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:items-center md:justify-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[70dvh] w-full overflow-y-auto rounded-t-2xl border-t bg-background p-4 md:max-w-sm md:rounded-2xl md:border"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col">{children}</div>
      </div>
    </div>
  );
}

function Option({
  label,
  count,
  selected,
  multi = false,
  disabled = false,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  multi?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={multi ? "menuitemcheckbox" : "menuitemradio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm capitalize hover:bg-muted disabled:opacity-50 ${selected ? "font-semibold" : ""}`}
    >
      <span className="flex items-center gap-3">
        {multi && (
          <span
            aria-hidden="true"
            className={`size-4 rounded border ${selected ? "border-primary bg-primary" : "border-input"}`}
          />
        )}
        <span className={multi ? "normal-case" : ""}>{label}</span>
      </span>
      {count !== undefined && (
        <span className="tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function ResultRow({ card }: { card: SearchCard }) {
  const { payload } = card;
  const meta = [
    payload.category,
    card.ago,
    `${card.outlets} ${card.outlets === 1 ? "outlet" : "outlets"}`,
  ].filter(Boolean);
  return (
    <li>
      <Link href={`/?card=${card.id}`} className="flex gap-3 py-3">
        <StoryThumb
          image={card.image}
          category={payload.category}
          className="size-16 rounded-lg"
          sizes="64px"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground first-letter:uppercase">
            {meta.join(" · ")}
          </p>
          <p className="line-clamp-3 font-semibold leading-snug">
            {payload.headline}
          </p>
          {card.checking && (
            <p className="text-xs text-muted-foreground">
              Some details still being checked
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
