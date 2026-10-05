"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type TouchEvent,
} from "react";
import { Button } from "@/components/ui/button";
import CardView from "@/components/card-view";
import { PageLoader } from "@/components/global-loader";
import ShortsNav, { useShortsKeys } from "@/components/shorts-nav";
import type { FeedCard, FeedPage } from "@/lib/public-data";

const PREFETCH_WITHIN = 3;
const SWIPE_MIN = 60;
const WHEEL_MIN = 50;
const WHEEL_COOLDOWN_MS = 700;
const WHEEL_GESTURE_GAP_MS = 200;
const WHEEL_IDLE_RESET_MS = 800;
const WHEEL_EDGE_DWELL_MS = 350;

const STATE_KEY = "feed-state:v1";
const STATE_MAX_AGE_MS = 30 * 60 * 1000;
const SAVE_DELAY_MS = 300;

type SavedState = {
  category: string;
  cards: FeedCard[];
  next: string | null;
  index: number;
  savedAt: number;
};

function readSaved(): SavedState | null {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedState;
    if (
      typeof s?.category !== "string" ||
      !Array.isArray(s.cards) ||
      !s.cards.length ||
      typeof s.index !== "number" ||
      typeof s.savedAt !== "number" ||
      Date.now() - s.savedAt > STATE_MAX_AGE_MS
    )
      return null;
    return { ...s, index: Math.min(Math.max(s.index, 0), s.cards.length) };
  } catch {
    return null;
  }
}

function writeSaved(s: Omit<SavedState, "savedAt">) {
  try {
    window.sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({ ...s, savedAt: Date.now() }),
    );
  } catch {
  }
}

function pageEdges() {
  const root = document.documentElement;
  return {
    atTop: window.scrollY <= 1,
    atBottom: window.innerHeight + window.scrollY >= root.scrollHeight - 2,
  };
}

const noSubscribe = () => () => {};

async function fetchPage(
  category: string,
  cursor: string | null,
): Promise<FeedPage | null> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/feed?${params}`).catch(() => null);
  return res?.ok ? res.json() : null;
}

type ReaderStart = {
  category: string;
  cards: FeedCard[];
  next: string | null;
  index: number;
};

export default function FeedReader({
  initial,
  categories,
  category,
  categoryParam,
  requestedCard,
  found,
  index,
}: {
  initial: FeedPage;
  categories: string[];
  category: string;
  categoryParam: boolean;
  requestedCard: string;
  found: boolean;
  index: number;
}) {
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [saved] = useState<SavedState | null>(() => {
    if (typeof window === "undefined") return null;
    const s = readSaved();
    if (!s) return null;
    if (requestedCard) {
      const current = s.cards[Math.min(s.index, s.cards.length - 1)];
      if (!found || current?.id !== requestedCard || s.category !== category)
        return null;
    } else if (categoryParam && s.category !== category) {
      return null;
    }
    return s;
  });
  const restored = hydrated ? saved : null;
  const start: ReaderStart = restored ?? {
    category,
    cards: initial.cards,
    next: initial.next,
    index,
  };
  return (
    <Reader
      key={restored ? "saved" : "server"}
      start={start}
      categories={categories}
    />
  );
}

function Reader({
  start,
  categories,
}: {
  start: ReaderStart;
  categories: string[];
}) {
  const [category, setCategory] = useState(start.category);
  const [cards, setCards] = useState<FeedCard[]>(start.cards);
  const [next, setNext] = useState(start.next);
  const [index, setIndex] = useState(start.index);
  const [switching, setSwitching] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const inflight = useRef<string | null>(null);
  const touch = useRef<{
    x: number;
    y: number;
    atTop: boolean;
    atBottom: boolean;
  } | null>(null);

  const caughtUp = cards.length > 0 && !next && index >= cards.length;
  const card = cards[index] ?? null;
  const maxIndex = next ? cards.length - 1 : cards.length;

  const go = useCallback(
    (step: number) =>
      setIndex((i) => Math.min(Math.max(i + step, 0), Math.max(maxIndex, 0))),
    [maxIndex],
  );
  useShortsKeys(go, true);

  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);

  useEffect(() => {
    let total = 0;
    let lastAt = -Infinity;
    let cooldownUntil = 0;
    let used = false;
    let startedAtEdge = false;
    let edgeSince: number | null = null;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) return;
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const dy = e.deltaY * unit;
      const dx = e.deltaX * unit;
      if (dy === 0 || Math.abs(dx) > Math.abs(dy)) return;
      const now = e.timeStamp;
      const gap = now - lastAt;
      lastAt = now;
      const turned = total !== 0 && Math.sign(dy) !== Math.sign(total);
      const edges = pageEdges();
      const atEdge = dy > 0 ? edges.atBottom : edges.atTop;
      if (gap > WHEEL_GESTURE_GAP_MS || turned) {
        used = false;
        startedAtEdge = atEdge;
      }
      if (gap > WHEEL_IDLE_RESET_MS || turned) total = 0;
      if (used) {
        e.preventDefault();
        return;
      }
      if (!atEdge) {
        edgeSince = null;
        total = 0;
        return;
      }
      edgeSince ??= now;
      if (now < cooldownUntil) return;
      total += dy;
      const ready = startedAtEdge || now - edgeSince >= WHEEL_EDGE_DWELL_MS;
      if (ready && Math.abs(total) >= WHEEL_MIN) {
        e.preventDefault();
        goRef.current(total > 0 ? 1 : -1);
        total = 0;
        used = true;
        edgeSince = null;
        cooldownUntil = now + WHEEL_COOLDOWN_MS;
      }
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const latest = useRef<Omit<SavedState, "savedAt"> | null>(null);
  useEffect(() => {
    if (!cards.length) return;
    latest.current = { category, cards, next, index };
    const timer = setTimeout(() => {
      if (latest.current) writeSaved(latest.current);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [category, cards, next, index]);

  useEffect(() => {
    const flush = () => {
      if (latest.current) writeSaved(latest.current);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    if (!next || failed || index < cards.length - PREFETCH_WITHIN) return;
    const gen = generation.current;
    const key = `${gen}:${next}`;
    if (inflight.current === key) return;
    inflight.current = key;
    fetchPage(category, next).then((page) => {
      if (gen !== generation.current) return;
      inflight.current = null;
      if (!page) {
        setFailed(true);
        return;
      }
      setCards((list) => [...list, ...page.cards]);
      setNext(page.next);
    });
  }, [index, cards.length, next, failed, category]);

  async function loadCategory(value: string) {
    const gen = ++generation.current;
    inflight.current = null;
    setCategory(value);
    setCards([]);
    setNext(null);
    setIndex(0);
    setFailed(false);
    setSwitching(true);
    const page = await fetchPage(value, null);
    if (gen !== generation.current) return;
    setSwitching(false);
    if (!page) {
      setFailed(true);
      return;
    }
    setCards(page.cards);
    setNext(page.next);
  }

  useEffect(() => {
    if (!card) return;
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    params.set("card", card.id);
    window.history.replaceState(null, "", `?${params}`);
  }, [card, category]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [card?.id, caughtUp]);

  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    return () => {
      root.style.overscrollBehaviorY = before;
    };
  }, []);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, ...pageEdges() };
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) < SWIPE_MIN || Math.abs(dy) < Math.abs(dx) * 1.5) return;
    if (dy < 0 && start.atBottom) go(1);
    else if (dy > 0 && start.atTop) go(-1);
  }

  const shown = Math.min(index + 1, cards.length);
  const waiting = !caughtUp && !card && !failed;

  return (
    <main
      className="mx-auto max-w-2xl space-y-5 p-4 pb-32 md:p-6 md:pb-24 md:pr-24"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex items-center justify-between gap-3 md:items-start">
        <div className="-ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pl-4 [scrollbar-width:none] md:ml-0 md:flex-wrap md:overflow-visible md:pl-0 [&::-webkit-scrollbar]:hidden">
          {["", ...categories].map((c) => (
            <Button
              key={c || "all"}
              type="button"
              size="sm"
              variant={category === c ? "default" : "outline"}
              aria-pressed={category === c}
              onClick={() => c !== category && loadCategory(c)}
              className="shrink-0 rounded-full capitalize"
            >
              {c || "All"}
            </Button>
          ))}
        </div>
        {cards.length > 0 && (
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground md:pt-1.5">
            {shown} / {cards.length}
            {next ? "+" : ""}
          </span>
        )}
      </header>

      {card && (
        <CardView key={card.id} payload={card.payload} updated={card.updated} />
      )}

      {caughtUp && (
        <div className="space-y-2 rounded-2xl border bg-background p-8 text-center shadow-sm">
          <p className="text-lg font-semibold">You&apos;re all caught up</p>
          <p className="text-sm text-muted-foreground">
            That&apos;s every {category ? `${category} ` : ""}short for now.
          </p>
          <Button type="button" variant="outline" onClick={() => setIndex(0)}>
            Back to the top
          </Button>
        </div>
      )}

      {waiting &&
        (switching || next ? (
          <PageLoader />
        ) : (
          <p className="text-sm text-muted-foreground">No news here yet.</p>
        ))}

      {failed && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-red-600">Couldn&apos;t load more news.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              cards.length ? setFailed(false) : loadCategory(category)
            }
          >
            Try again
          </Button>
        </div>
      )}

      <ShortsNav
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        canPrev={index > 0}
        canNext={index < maxIndex}
      />
    </main>
  );
}
