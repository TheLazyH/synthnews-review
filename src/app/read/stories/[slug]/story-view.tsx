"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MyStoryFeedback, StorySource, StoryVerdict } from "@/lib/types";
import type { StoryReaderItem } from "./story-reader";

const VERDICTS: { value: StoryVerdict; label: string; hint: string }[] = [
  {
    value: "good",
    label: "One event",
    hint: "Every update is the same incident, case, decision or deal.",
  },
  {
    value: "wrong_link",
    label: "Wrong entries",
    hint: "Mark the updates that belong to a different event.",
  },
  {
    value: "series_not_story",
    label: "Series",
    hint: "Related but separate events, like results from one tournament.",
  },
  {
    value: "missing_link",
    label: "Missing link",
    hint: "An update is missing, or this should join another story. Say which in the note.",
  },
];

const ONE_TAP = new Set<StoryVerdict>(["good", "series_not_story"]);

const ERRORS: Record<string, string> = {
  entries_required: "Mark at least one update that doesn't belong.",
  note_required: "Add a note saying which update or story is missing.",
  list_closed: "This list is closed. Feedback can no longer be saved.",
};

function domainChips(sources: StorySource[]) {
  const first = new Map<string, StorySource>();
  for (const s of sources) if (!first.has(s.source)) first.set(s.source, s);
  return [...first.values()];
}

export default function StoryView({
  item,
  saved,
  onSaved,
}: {
  item: StoryReaderItem;
  saved: MyStoryFeedback | null;
  onSaved: (feedback: MyStoryFeedback) => void;
}) {
  const { headline, category, timeline, source_count } = item.payload;
  const [verdict, setVerdict] = useState<StoryVerdict | null>(
    saved?.verdict ?? null,
  );
  const [badEntries, setBadEntries] = useState<number[]>(
    saved?.bad_entries ?? [],
  );
  const [note, setNote] = useState(saved?.note ?? "");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const marking = verdict === "wrong_link";
  const active = VERDICTS.find((v) => v.value === verdict);
  const savedLabel = saved
    ? VERDICTS.find((v) => v.value === saved.verdict)?.label
    : null;
  const canSave =
    verdict === "wrong_link"
      ? badEntries.length > 0
      : verdict === "missing_link"
        ? note.trim().length > 0
        : false;

  function edit() {
    setTouched(true);
    setError("");
  }

  function toggleEntry(n: number) {
    edit();
    setBadEntries((list) =>
      list.includes(n) ? list.filter((x) => x !== n) : [...list, n],
    );
  }

  async function submit(next: StoryVerdict) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/read/items/${item.id}/story-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict: next,
        bad_entries: next === "wrong_link" ? badEntries : [],
        note,
        time_spent_ms: Date.now() - startedAt.current,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(
        ERRORS[data.error] ??
          "Save failed. Your feedback was not recorded. Try again.",
      );
      return;
    }
    startedAt.current = Date.now();
    setTouched(false);
    setVerdict(next);
    if (next !== "wrong_link") setBadEntries([]);
    onSaved(data.feedback);
  }

  function chooseVerdict(next: StoryVerdict) {
    if (ONE_TAP.has(next)) {
      submit(next);
      return;
    }
    edit();
    setVerdict(next);
    if (next !== "wrong_link") setBadEntries([]);
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="space-y-3 border-b bg-muted/50 p-5 sm:p-6">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium capitalize text-foreground">
              {category ?? "News"}
            </span>
            <span>
              {timeline.length} {timeline.length === 1 ? "update" : "updates"}{" "}
              over {item.span}
            </span>
            <span>
              {source_count} {source_count === 1 ? "source" : "sources"}
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            {headline}
          </h2>
          <p className="text-xs text-muted-foreground">
            A story should be one developing event, with new facts over time.
          </p>
        </div>

        <ol className="p-5 sm:p-6">
          {timeline.map((entry, n) => {
            const flagged = badEntries.includes(n);
            return (
              <li key={n} className="relative border-l pb-8 pl-5 last:pb-0">
                <span className="absolute -left-1.5 top-1.5 size-3 rounded-full border-2 bg-background" />
                <div
                  className={`space-y-2 rounded-lg ${
                    flagged
                      ? "-m-2 bg-red-500/10 p-2 ring-1 ring-red-500/40"
                      : ""
                  }`}
                >
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {item.times[n] ? `${item.times[n]} IST` : "Time unknown"}
                    {n === 0 ? " · latest" : ""}
                  </p>
                  <h3 className="font-semibold leading-snug">
                    {entry.headline}
                  </h3>
                  <p className="max-w-prose leading-7 text-foreground/85">
                    {entry.sentences.length
                      ? entry.sentences.join(" ")
                      : entry.summary}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {domainChips(entry.sources).map((s) => (
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
                    {marking && (
                      <Button
                        type="button"
                        size="sm"
                        variant={flagged ? "default" : "outline"}
                        aria-pressed={flagged}
                        onClick={() => toggleEntry(n)}
                        className="ml-auto"
                      >
                        {flagged ? "Doesn't belong ✓" : "Doesn't belong"}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </article>

      <section className="space-y-4 rounded-xl border bg-background/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Is this one story?
          </p>
          {saved && !touched && (
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              Saved: {savedLabel}
            </span>
          )}
          {touched && verdict && !ONE_TAP.has(verdict) && (
            <span className="text-sm text-muted-foreground">Not saved yet</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VERDICTS.map((v) => (
            <Button
              key={v.value}
              type="button"
              variant={verdict === v.value ? "default" : "outline"}
              disabled={busy}
              onClick={() => chooseVerdict(v.value)}
            >
              {v.label}
            </Button>
          ))}
        </div>

        {active && (
          <p className="text-xs text-muted-foreground">{active.hint}</p>
        )}

        <Textarea
          placeholder={
            verdict === "missing_link"
              ? "Which update or story is missing?"
              : "Note (optional)"
          }
          value={note}
          onChange={(e) => {
            edit();
            setNote(e.target.value);
          }}
          rows={2}
        />

        {verdict && !ONE_TAP.has(verdict) && (
          <Button
            type="button"
            onClick={() => submit(verdict)}
            disabled={busy || !canSave}
          >
            Save feedback
          </Button>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </>
  );
}
