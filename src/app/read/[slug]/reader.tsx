"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { MyFeedback, ReadItem } from "@/lib/types";
import ShortView from "./short-view";

export type ReaderItem = ReadItem & { updated: string };

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

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

  function changeCategory(next: string) {
    const nextVisible = next
      ? items.filter((i) => i.payload.category === next)
      : items;
    const keep = item ? nextVisible.findIndex((i) => i.id === item.id) : -1;
    setCategory(next);
    setIndex(Math.max(keep, 0));
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 pr-20 md:p-6 md:pr-24">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <Link href="/read" className="underline">
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

      <nav
        aria-label="Move between shorts"
        className="fixed bottom-6 right-4 flex flex-col gap-2 md:bottom-auto md:right-8 md:top-1/2 md:-translate-y-1/2"
      >
        <Button
          size="icon"
          variant="outline"
          onClick={() => go(-1)}
          disabled={index <= 0}
          aria-label="Previous short"
        >
          ↑
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => go(1)}
          disabled={index >= visible.length - 1}
          aria-label="Next short"
        >
          ↓
        </Button>
      </nav>
    </main>
  );
}
