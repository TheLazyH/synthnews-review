"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StoryDeckItem } from "@/lib/public-data";
import { useSeen } from "./seen";
import StoryThumb from "./story-thumb";
import StoryViewer from "./story-viewer";

type Open = { group: "rings" | "rows"; id: string };

export default function StoriesHome({
  stories,
  openId,
  closeHref,
}: {
  stories: StoryDeckItem[];
  openId?: string;
  closeHref?: string;
}) {
  const router = useRouter();
  const seen = useSeen();
  const rings = stories.filter((s) => s.today);
  const rows = stories.filter((s) => !s.today);
  const [open, setOpen] = useState<Open | null>(() => {
    const start = stories.find((s) => s.id === openId);
    return start ? { group: start.today ? "rings" : "rows", id: start.id } : null;
  });
  const pushed = useRef(false);

  useEffect(() => {
    if (!open || closeHref) return;
    function onPop() {
      pushed.current = false;
      setOpen(null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, closeHref]);

  function show(next: Open) {
    setOpen(next);
    if (closeHref) return;
    window.history.pushState({ viewer: next.id }, "", `?s=${next.id}`);
    pushed.current = true;
  }

  function close() {
    setOpen(null);
    if (closeHref) {
      router.replace(closeHref);
    } else if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  return (
    <main
      className="mx-auto max-w-2xl space-y-6 py-4 md:py-6"
      style={{
        paddingLeft: "max(env(safe-area-inset-left), 16px)",
        paddingRight: "max(env(safe-area-inset-right), 16px)",
      }}
    >
      <h1 className="text-xl font-semibold">Stories</h1>

      {stories.length === 0 && (
        <p className="text-sm text-muted-foreground">No stories yet.</p>
      )}

      {rings.length > 0 && (
        <section aria-label="Updated today" className="-mx-4">
          <div className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rings.map((s) => {
              const done = s.segments.every((seg) => seen.has(seg.id));
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => show({ group: "rings", id: s.id })}
                  aria-label={done ? `${s.headline} (seen)` : s.headline}
                  className="flex w-[4.75rem] shrink-0 snap-start flex-col items-center gap-1.5"
                >
                  <span
                    className={`flex size-[4.25rem] items-center justify-center rounded-full border-2 p-[3px] ${
                      done ? "border-foreground/25" : "border-foreground"
                    }`}
                  >
                    <StoryThumb
                      image={s.image}
                      category={s.category}
                      className="size-full rounded-full"
                      iconClassName="size-7"
                    />
                  </span>
                  <span
                    className={`w-full truncate text-center text-xs ${
                      done ? "text-muted-foreground" : ""
                    }`}
                  >
                    {s.headline}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-3">
          {rings.length > 0 && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Earlier
            </h2>
          )}
          <ul className="divide-y overflow-hidden rounded-xl border bg-background">
            {rows.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => show({ group: "rows", id: s.id })}
                  className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-muted"
                >
                  <StoryThumb
                    image={s.image}
                    category={s.category}
                    className="size-[72px] rounded-xl"
                    iconClassName="size-7"
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-xs text-muted-foreground">
                      <span className="capitalize">{s.category ?? "News"}</span>
                      {" · "}
                      {s.updates} updates · {s.outlets}{" "}
                      {s.outlets === 1 ? "outlet" : "outlets"} · {s.updated}
                    </span>
                    <span className="line-clamp-3 block font-semibold leading-snug">
                      {s.headline}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <StoryViewer
          key={`${open.group}-${open.id}`}
          stories={open.group === "rings" ? rings : rows}
          startId={open.id}
          seen={seen}
          onClose={close}
        />
      )}
    </main>
  );
}
