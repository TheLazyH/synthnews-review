"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Share2, X } from "lucide-react";
import ReportSheet from "@/components/report-sheet";
import ShareSheet from "@/components/share-sheet";
import type { StoryDeckItem } from "@/lib/public-data";
import CategoryIcon from "./category-icon";
import { markSeen } from "./seen";
import SourcesSheet from "./sources-sheet";

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function segmentMs(summary: string): number {
  const words = summary.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(Math.max(5000 + 250 * words, 6000), 20000);
}

function firstUnseen(story: StoryDeckItem, seen: Set<string>): number {
  return Math.max(
    0,
    story.segments.findIndex((s) => !seen.has(s.id)),
  );
}

type Press = { x: number; y: number; held: boolean; timer: number };

export default function StoryViewer({
  stories,
  startId,
  seen,
  onClose,
}: {
  stories: StoryDeckItem[];
  startId: string;
  seen: Set<string>;
  onClose: () => void;
}) {
  const [pos, setPos] = useState(() => {
    const story = Math.max(0, stories.findIndex((s) => s.id === startId));
    return { story, seg: firstUnseen(stories[story], seen), nonce: 0 };
  });
  const [held, setHeld] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [brokenImage, setBrokenImage] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );

  const story = stories[pos.story];
  const segment = story.segments[pos.seg];
  const paused = held || sheet || reporting || sharing || hidden;
  const image =
    segment.image && segment.image.url !== brokenImage ? segment.image : null;

  function next() {
    if (pos.seg < story.segments.length - 1) {
      setPos({ ...pos, seg: pos.seg + 1 });
    } else if (pos.story < stories.length - 1) {
      const nextStory = pos.story + 1;
      setPos({
        story: nextStory,
        seg: firstUnseen(stories[nextStory], seen),
        nonce: pos.nonce,
      });
    } else {
      onClose();
    }
  }

  function prev() {
    if (pos.seg > 0) {
      setPos({ ...pos, seg: pos.seg - 1 });
    } else if (pos.story > 0) {
      setPos({ story: pos.story - 1, seg: 0, nonce: pos.nonce });
    } else {
      setPos({ ...pos, nonce: pos.nonce + 1 });
    }
  }

  useEffect(() => {
    markSeen(segment.id);
  }, [segment.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (reporting || sharing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (sheet) setSheet(false);
        else onClose();
      } else if (!sheet && e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (!sheet && e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function endPress() {
    const p = press.current;
    press.current = null;
    if (p) window.clearTimeout(p.timer);
    setHeld(false);
    setDragY(0);
    return p;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p: Press = {
      x: e.clientX,
      y: e.clientY,
      held: false,
      timer: window.setTimeout(() => {
        p.held = true;
        setHeld(true);
      }, 250),
    };
    press.current = p;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    if (Math.abs(dy) > 10 || Math.abs(e.clientX - p.x) > 10) {
      window.clearTimeout(p.timer);
    }
    setDragY(Math.max(0, dy));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const p = endPress();
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (dy > 90 && dy > Math.abs(dx)) {
      onClose();
      return;
    }
    if (p.held || Math.abs(dx) > 30 || Math.abs(dy) > 30) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const at = (e.clientX - rect.left) / rect.width;
    if (at < 1 / 3) prev();
    else if (at > 2 / 3) next();
  }

  const outletLabel = `${segment.outlets} ${segment.outlets === 1 ? "outlet" : "outlets"}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={story.headline}
      className="fixed inset-0 z-[90] h-[100dvh] overflow-hidden bg-background text-foreground"
    >
      <div
        className="mx-auto flex h-full max-w-lg flex-col"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          opacity: dragY ? Math.max(0.4, 1 - dragY / 400) : undefined,
        }}
      >
        <div className="flex gap-1 px-3" aria-hidden="true">
          {story.segments.map((s, n) => (
            <div
              key={s.id}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-foreground/20"
            >
              {n < pos.seg || (n === pos.seg && reduced) ? (
                <div className="h-full bg-foreground" />
              ) : n === pos.seg ? (
                <div
                  key={`${story.id}-${pos.seg}-${pos.nonce}`}
                  className="h-full origin-left bg-foreground"
                  style={{
                    animation: `story-progress ${segmentMs(segment.summary)}ms linear forwards`,
                    animationPlayState: paused ? "paused" : "running",
                  }}
                  onAnimationEnd={next}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 px-3 pt-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <CategoryIcon category={story.category} className="size-4" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {story.headline}
          </p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {pos.seg + 1} / {story.segments.length}
          </span>
          <button
            type="button"
            onClick={() => setSharing(true)}
            aria-label="Share story"
            className="rounded-full p-2 hover:bg-muted"
          >
            <Share2 className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story"
            autoFocus
            className="-mr-1 rounded-full p-2 hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 cursor-pointer touch-none select-none flex-col justify-center gap-4 overflow-hidden px-6 [-webkit-touch-callout:none]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={endPress}
          onContextMenu={(e) => e.preventDefault()}
        >
          {image && (
            <figure className="space-y-1">
              <div className="relative aspect-video max-h-[32dvh] w-full overflow-hidden rounded-xl bg-muted">
                <Image
                  key={image.url}
                  src={image.url}
                  alt={`Image: ${image.credit}`}
                  fill
                  unoptimized
                  sizes="(max-width: 512px) 100vw, 512px"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  draggable={false}
                  onError={() => setBrokenImage(image.url)}
                  className="pointer-events-none object-cover"
                />
              </div>
              <figcaption className="truncate text-[0.6875rem] text-muted-foreground">
                Image: {image.credit}
              </figcaption>
            </figure>
          )}
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <CategoryIcon category={segment.category} className="size-3.5" />
            {segment.category ?? "News"}
          </p>
          <h2 className="text-2xl font-semibold leading-snug tracking-tight">
            {segment.headline}
          </h2>
          <p className="text-[1.0625rem] leading-7 text-foreground/85">
            {segment.summary}
          </p>
          {segment.checking && (
            <p className="text-xs text-muted-foreground">
              Some details still being checked
            </p>
          )}
        </div>

        <p className="px-6 pt-3 text-sm text-muted-foreground">
          Reported by{" "}
          <button
            type="button"
            onClick={() => setSheet(true)}
            disabled={segment.sources.length === 0}
            className="font-medium text-foreground underline underline-offset-2 disabled:no-underline"
          >
            {outletLabel}
          </button>{" "}
          · {segment.updated}
        </p>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="self-start px-6 pt-1 text-xs text-muted-foreground underline underline-offset-2"
        >
          Report an issue
        </button>
      </div>

      {reporting && (
        <ReportSheet cardId={segment.id} onClose={() => setReporting(false)} />
      )}
      {sharing && (
        <ShareSheet
          path={`/stories/${story.id}`}
          headline={story.headline}
          campaign="story"
          onClose={() => setSharing(false)}
        />
      )}
      {sheet && (
        <SourcesSheet sources={segment.sources} onClose={() => setSheet(false)} />
      )}
    </div>
  );
}
