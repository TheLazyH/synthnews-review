"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShortsNav, { useShortsKeys } from "@/components/shorts-nav";
import type { MyFeedback, ReadItem } from "@/lib/types";
import ShortView from "./short-view";

export type ReaderItem = ReadItem & { updated: string };

export default function Reader({
  title,
  items,
  initialCategory,
  initialId,
}: {
  title: string;
  items: ReaderItem[];
  initialCategory: string;
  initialId: string;
}) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      const c = it.payload.category;
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const [category, setCategory] = useState(
    categories.some(([c]) => c === initialCategory) ? initialCategory : "",
  );
  const visible = useMemo(
    () =>
      category ? items.filter((i) => i.payload.category === category) : items,
    [items, category],
  );
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      visible.findIndex((i) => i.id === initialId),
    ),
  );
  const item = visible[index] ?? null;
  const [feedback, setFeedback] = useState<Record<string, MyFeedback | null>>(
    () => Object.fromEntries(items.map((i) => [i.id, i.feedback])),
  );
  const rated = Object.values(feedback).filter(Boolean).length;

  const go = useCallback(
    (step: number) =>
      setIndex((i) =>
        Math.min(Math.max(i + step, 0), Math.max(visible.length - 1, 0)),
      ),
    [visible.length],
  );

  useShortsKeys(go);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("c", category);
    if (item) params.set("id", item.id);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  }, [category, item]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [item?.id]);

  function changeCategory(next: string) {
    const nextVisible = next
      ? items.filter((i) => i.payload.category === next)
      : items;
    const keep = item ? nextVisible.findIndex((i) => i.id === item.id) : -1;
    setCategory(next);
    setIndex(Math.max(keep, 0));
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 pb-32 md:p-6 md:pb-24 md:pr-24">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <Link href="/review" className="underline">
            ← All dates
          </Link>
          {visible.length > 0 && (
            <span className="tabular-nums text-muted-foreground">
              {index + 1} / {visible.length} · {rated} rated
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <select
            value={category}
            onChange={(e) => changeCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-9 rounded-md border bg-background px-3 text-sm capitalize"
          >
            <option value="">All categories ({items.length})</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>
                {c} ({n})
              </option>
            ))}
          </select>
        </div>
      </header>

      {!item ? (
        <p className="text-sm text-muted-foreground">No shorts in this list.</p>
      ) : (
        <ShortView
          key={item.id}
          item={item}
          saved={feedback[item.id] ?? null}
          onSaved={(f) => setFeedback((m) => ({ ...m, [item.id]: f }))}
        />
      )}

      <ShortsNav
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        canPrev={index > 0}
        canNext={index < visible.length - 1}
      />
    </main>
  );
}
