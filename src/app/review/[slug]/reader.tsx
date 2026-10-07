"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShortsNav, { useShortsKeys } from "@/components/shorts-nav";
import { Button } from "@/components/ui/button";
import type { MyFeedback, ReadItem, StatusFilter } from "@/lib/types";
import ShortView from "./short-view";

export type ReaderItem = ReadItem & { updated: string };

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "needs_review", label: "Needs review" },
  { value: "reported", label: "Reported" },
];

function matches(item: ReaderItem, category: string, status: StatusFilter) {
  return (
    (!category || item.payload.category === category) &&
    (status === "all" ||
      (status === "reported" ? item.reportCount > 0 : item.status === status))
  );
}

export default function Reader({
  title,
  items,
  initialCategory,
  initialId,
  initialStatus = "all",
  showStatus = false,
  note,
}: {
  title: string;
  items: ReaderItem[];
  initialCategory: string;
  initialId: string;
  initialStatus?: StatusFilter;
  showStatus?: boolean;
  note?: string;
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
  const statusCounts = useMemo(() => {
    const needs = items.filter((i) => i.status === "needs_review").length;
    const reported = items.filter((i) => i.reportCount > 0).length;
    return {
      all: items.length,
      active: items.length - needs,
      needs_review: needs,
      reported,
    };
  }, [items]);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const visible = useMemo(
    () => items.filter((i) => matches(i, category, status)),
    [items, category, status],
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
    if (status !== "all") params.set("status", status);
    if (item) params.set("id", item.id);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  }, [category, status, item]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [item?.id]);

  function changeFilter(nextCategory: string, nextStatus: StatusFilter) {
    const nextVisible = items.filter((i) => matches(i, nextCategory, nextStatus));
    const keep = item ? nextVisible.findIndex((i) => i.id === item.id) : -1;
    setCategory(nextCategory);
    setStatus(nextStatus);
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
            onChange={(e) => changeFilter(e.target.value, status)}
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
        {showStatus && (
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s.value}
                type="button"
                size="sm"
                variant={status === s.value ? "default" : "outline"}
                aria-pressed={status === s.value}
                onClick={() => s.value !== status && changeFilter(category, s.value)}
                className="rounded-full"
              >
                {s.label} ({statusCounts[s.value]})
              </Button>
            ))}
          </div>
        )}
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </header>

      {!item ? (
        <p className="text-sm text-muted-foreground">No shorts here.</p>
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
