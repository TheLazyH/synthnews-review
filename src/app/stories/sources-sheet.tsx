"use client";

import { X } from "lucide-react";
import type { StorySource } from "@/lib/public-data";

export default function SourcesSheet({
  sources,
  onClose,
}: {
  sources: StorySource[];
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sources"
        className="max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t bg-background p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Sources</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sources"
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="divide-y">
          {sources.map((s, n) => (
            <li key={`${s.url}-${n}`} className="py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {s.source}
              </p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium leading-snug underline underline-offset-2"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
