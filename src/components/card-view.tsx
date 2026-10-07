"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import ReportSheet from "@/components/report-sheet";
import type { CardImage, CardPayload, CardSource } from "@/lib/types";

export function domainChips(sources: CardSource[]) {
  const first = new Map<string, CardSource>();
  for (const s of sources) if (!first.has(s.source)) first.set(s.source, s);
  return [...first.values()];
}

type BandImage = { url: string; credit: string };

function bandImages(
  image: CardImage | null | undefined,
  sources: CardSource[],
): BandImage[] {
  const list: BandImage[] = [];
  if (image?.url) list.push({ url: image.url, credit: image.credit });
  for (const s of sources)
    if (s.image_url) list.push({ url: s.image_url, credit: s.source });
  const seen = new Set<string>();
  return list.filter((i) => !seen.has(i.url) && !!seen.add(i.url));
}

function CoverBand({
  images: all,
  headline,
  category,
  updated,
  sourceCount,
}: {
  images: BandImage[];
  headline: string;
  category: string | null;
  updated: string;
  sourceCount: number;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const images = all.filter((i) => !failed.includes(i.url));
  const current = Math.min(index, Math.max(images.length - 1, 0));
  const last = images.length - 1;

  useEffect(() => {
    if (!auto || current >= last) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setIndex(current + 1), 5000);
    return () => clearTimeout(timer);
  }, [auto, current, last]);

  const cover = coverStyles(category);
  const shown = images.length > 0;
  const many = images.length > 1;

  function goTo(n: number) {
    setAuto(false);
    setIndex(Math.max(0, Math.min(n, last)));
  }

  return (
    <div
      className={`relative flex aspect-[16/7] flex-col justify-end gap-1 overflow-hidden p-5 sm:p-6 ${
        shown ? "bg-black pb-9 sm:pb-10" : cover.tint ? "" : "bg-muted"
      }`}
      style={shown ? undefined : cover.tint}
      onTouchStart={
        many
          ? (e) =>
              (touchStart.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
              })
          : undefined
      }
      onTouchEnd={
        many
          ? (e) => {
              const start = touchStart.current;
              touchStart.current = null;
              if (!start) return;
              const dx = e.changedTouches[0].clientX - start.x;
              const dy = e.changedTouches[0].clientY - start.y;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy))
                goTo(current + (dx < 0 ? 1 : -1));
            }
          : undefined
      }
    >
      {shown && (
        <>
          {images.map((img, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.url}
              src={img.url}
              alt={`${img.credit}: ${headline}`}
              referrerPolicy="no-referrer"
              loading={n === 0 ? undefined : "lazy"}
              onError={() => setFailed((f) => [...f, img.url])}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${
                n === current ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/30 to-transparent" />
        </>
      )}
      <span
        className={`relative text-3xl font-semibold capitalize tracking-tight sm:text-4xl ${
          shown ? "text-white" : ""
        }`}
        style={shown ? undefined : cover.ink}
      >
        {category ?? "News"}
      </span>
      <div
        className={`relative flex flex-wrap gap-x-4 gap-y-1 text-xs ${
          shown ? "text-white/85" : "text-muted-foreground"
        }`}
      >
        <span>Updated {updated} IST</span>
        <span>
          {sourceCount} {sourceCount === 1 ? "source" : "sources"}
        </span>
      </div>
      {shown && (
        <>
          {many && current > 0 && (
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => goTo(current - 1)}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white transition hover:bg-black/60"
            >
              ‹
            </button>
          )}
          {many && current < last && (
            <button
              type="button"
              aria-label="Next image"
              onClick={() => goTo(current + 1)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white transition hover:bg-black/60"
            >
              ›
            </button>
          )}
          {many && (
            <div className="absolute bottom-3 left-5 flex gap-1.5 sm:left-6">
              {images.map((img, n) => (
                <button
                  key={img.url}
                  type="button"
                  aria-label={`Show image ${n + 1} of ${images.length}`}
                  aria-current={n === current}
                  onClick={() => goTo(n)}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    n === current ? "bg-white" : "bg-white/45 hover:bg-white/75"
                  }`}
                />
              ))}
            </div>
          )}
          <span className="absolute bottom-2.5 right-3 max-w-[60%] truncate text-[0.6875rem] text-white/75">
            Image: {images[current].credit}
          </span>
        </>
      )}
    </div>
  );
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hueOf(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function coverStyles(category: string | null): {
  tint?: CSSProperties;
  ink?: CSSProperties;
} {
  if (!category) return {};
  const h = hueOf(category);
  return {
    tint: {
      backgroundColor: `color-mix(in oklab, hsl(${h} 70% 50%) 14%, transparent)`,
    },
    ink: {
      color: `color-mix(in oklab, hsl(${h} 70% 45%) 70%, currentColor)`,
    },
  };
}

export default function CardView({
  payload,
  updated,
  marking = false,
  badSentences = [],
  onToggleSentence,
  noImages = false,
  checking = false,
  reportId,
}: {
  payload: CardPayload;
  updated: string;
  noImages?: boolean;
  checking?: boolean;
  reportId?: string;
  marking?: boolean;
  badSentences?: number[];
  onToggleSentence?: (n: number) => void;
}) {
  const { headline, sentences, category, sources, image } = payload;
  const chips = domainChips(sources);
  const original = sentences.join(" ");
  const [reporting, setReporting] = useState(false);
  return (
    <article className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <CoverBand
        images={noImages ? [] : bandImages(image, sources)}
        headline={headline}
        category={category}
        updated={updated}
        sourceCount={chips.length}
      />

      <div className="space-y-4 p-5 sm:p-6">
        <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
          {headline}
        </h2>
        <p className="max-w-prose text-[1.0625rem] leading-7 text-foreground/85">
          {sentences.map((sentence, n) => (
            <span key={n}>
              {n > 0 && " "}
              {marking ? (
                <button
                  type="button"
                  aria-pressed={badSentences.includes(n)}
                  onClick={() => onToggleSentence?.(n)}
                  className={`inline rounded text-left underline-offset-4 ${
                    badSentences.includes(n)
                      ? "bg-red-500/10 underline decoration-red-500 decoration-2"
                      : "hover:bg-muted"
                  }`}
                >
                  {sentence}
                </button>
              ) : (
                sentence
              )}
            </span>
          ))}
        </p>
        {checking && (
          <p className="text-xs text-muted-foreground">
            Some details still being checked
          </p>
        )}
        {marking && (
          <p className="text-xs text-muted-foreground">
            Tap each sentence the sources don&apos;t support.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {chips.map((s) => (
            <a
              key={s.source}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.title}
              className="rounded-full border px-3 py-1 text-xs font-medium transition hover:bg-muted"
            >
              {s.source} ↗
            </a>
          ))}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {wordCount(original)} words
          </span>
        </div>
        {reportId && (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Report an issue
          </button>
        )}
      </div>
      {reportId && reporting && (
        <ReportSheet cardId={reportId} onClose={() => setReporting(false)} />
      )}
    </article>
  );
}
