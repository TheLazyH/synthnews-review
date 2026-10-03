"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { MyStoryFeedback, StoryItem } from "@/lib/types";
import StoryView from "./story-view";

export type StoryReaderItem = StoryItem & { span: string; times: string[] };

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

export default function StoryReader({
  title,
  items,
  initialId,
}: {
  title: string;
  items: StoryReaderItem[];
  initialId: string;
}) {
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      items.findIndex((i) => i.id === initialId),
    ),
  );
  const item = items[index] ?? null;
  const [feedback, setFeedback] = useState<Record<string, MyStoryFeedback | null>>(
    () => Object.fromEntries(items.map((i) => [i.id, i.feedback])),
  );
  const rated = Object.values(feedback).filter(Boolean).length;

  const go = useCallback(
    (step: number) =>
      setIndex((i) => Math.min(Math.max(i + step, 0), Math.max(items.length - 1, 0))),
    [items.length],
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
    window.history.replaceState(
      null,
      "",
      item ? `?id=${item.id}` : window.location.pathname,
    );
  }, [item]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [item?.id]);

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 pb-32 md:p-6 md:pb-24 md:pr-24">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <Link href="/read/stories" className="underline">
            ← All lists
          </Link>
          {items.length > 0 && (
            <span className="tabular-nums text-muted-foreground">
              {index + 1} / {items.length} · {rated} rated
            </span>
          )}
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>

      {!item ? (
        <p className="text-sm text-muted-foreground">No stories in this list.</p>
      ) : (
        <StoryView
          key={item.id}
          item={item}
          saved={feedback[item.id] ?? null}
          onSaved={(f) => setFeedback((m) => ({ ...m, [item.id]: f }))}
        />
      )}

      <nav
        aria-label="Move between stories"
        className="fixed bottom-4 left-4 z-40 flex flex-row gap-1 rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur md:bottom-auto md:left-auto md:right-8 md:top-1/2 md:-translate-y-1/2 md:flex-col"
      >
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => go(-1)}
          disabled={index <= 0}
          aria-label="Previous story"
        >
          ↑
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => go(1)}
          disabled={index >= items.length - 1}
          aria-label="Next story"
        >
          ↓
        </Button>
      </nav>
    </main>
  );
}