"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  CardIssue,
  CardSource,
  CardVerdict,
  MyFeedback,
} from "@/lib/types";
import type { ReaderItem } from "./reader";

const VERDICTS: { value: CardVerdict; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "needs_fix", label: "Needs fix" },
  { value: "wrong", label: "Wrong" },
];

const ISSUES: { value: CardIssue; label: string }[] = [
  { value: "not_in_sources", label: "Not in sources" },
  { value: "mixed_events", label: "Mixed events" },
  { value: "copied", label: "Copied" },
  { value: "bad_headline", label: "Bad headline" },
];

const ERRORS: Record<string, string> = {
  issue_required: "Pick at least one issue.",
  list_closed: "This list is closed. Feedback can no longer be saved.",
  title_too_long:
    "The suggested title is too long. Keep it under 255 characters.",
  summary_too_long:
    "The suggested summary is too long. Keep it under 2000 characters.",
};

function domainChips(sources: CardSource[]) {
  const first = new Map<string, CardSource>();
  for (const s of sources) if (!first.has(s.source)) first.set(s.source, s);
  return [...first.values()];
}

function wordCount(text: string) {
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

export default function ShortView({
  item,
  saved,
  onSaved,
}: {
  item: ReaderItem;
  saved: MyFeedback | null;
  onSaved: (feedback: MyFeedback) => void;
}) {
  const { headline, sentences, category, sources } = item.payload;
  const original = sentences.join(" ");
  const [verdict, setVerdict] = useState<CardVerdict | null>(
    saved?.verdict ?? null,
  );
  const [issues, setIssues] = useState<CardIssue[]>(saved?.issues ?? []);
  const [badSentences, setBadSentences] = useState<number[]>(
    saved?.bad_sentences ?? [],
  );
  const [title, setTitle] = useState(saved?.suggested_title ?? headline);
  const [summary, setSummary] = useState(saved?.suggested_summary ?? original);
  const [note, setNote] = useState(saved?.note ?? "");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const marking = issues.includes("not_in_sources");
  const chips = domainChips(sources);
  const cover = coverStyles(category);
  const savedLabel = saved
    ? VERDICTS.find((v) => v.value === saved.verdict)?.label
    : null;

  function edit() {
    setTouched(true);
    setError("");
  }

  function toggleIssue(value: CardIssue) {
    edit();
    if (issues.includes(value)) {
      setIssues(issues.filter((i) => i !== value));
      if (value === "not_in_sources") setBadSentences([]);
    } else {
      setIssues([...issues, value]);
    }
  }

  function toggleSentence(n: number) {
    edit();
    setBadSentences((list) =>
      list.includes(n) ? list.filter((x) => x !== n) : [...list, n],
    );
  }

  async function submit(next: CardVerdict) {
    const body =
      next === "good"
        ? { verdict: "good", note }
        : {
            verdict: next,
            issues,
            bad_sentences: badSentences,
            suggested_title: next === "needs_fix" ? title : null,
            suggested_summary: next === "needs_fix" ? summary : null,
            note,
          };
    setBusy(true);
    setError("");
    const res = await fetch(`/api/read/items/${item.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
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
    if (next === "good") {
      setVerdict("good");
      setIssues([]);
      setBadSentences([]);
      setTitle(headline);
      setSummary(original);
    }
    onSaved(data.feedback);
  }

  function chooseVerdict(next: CardVerdict) {
    if (next === "good") {
      submit("good");
      return;
    }
    edit();
    setVerdict(next);
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div
          className={`flex aspect-[16/7] flex-col justify-end gap-1 p-5 sm:p-6 ${
            cover.tint ? "" : "bg-muted"
          }`}
          style={cover.tint}
        >
          <span
            className="text-3xl font-semibold capitalize tracking-tight sm:text-4xl"
            style={cover.ink}
          >
            {category ?? "News"}
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Updated {item.updated} IST</span>
            <span>
              {chips.length} {chips.length === 1 ? "source" : "sources"}
            </span>
          </div>
        </div>

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
                    onClick={() => toggleSentence(n)}
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
        </div>
      </article>

      <section className="space-y-4 rounded-xl border bg-background/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            How is this short?
          </p>
          {saved && !touched && (
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              Saved: {savedLabel}
            </span>
          )}
          {touched && verdict && verdict !== "good" && (
            <span className="text-sm text-muted-foreground">Not saved yet</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
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

        {verdict && verdict !== "good" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm">What&apos;s wrong? Pick at least one.</p>
              <div className="flex flex-wrap gap-2">
                {ISSUES.map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    size="sm"
                    variant={issues.includes(o.value) ? "default" : "outline"}
                    aria-pressed={issues.includes(o.value)}
                    onClick={() => toggleIssue(o.value)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>

            {verdict === "needs_fix" && (
              <div className="space-y-2">
                <p className="text-sm">Suggest a fix (optional)</p>
                <Textarea
                  aria-label="Suggested title"
                  value={title}
                  onChange={(e) => {
                    edit();
                    setTitle(e.target.value);
                  }}
                  rows={2}
                />
                <Textarea
                  aria-label="Suggested summary"
                  value={summary}
                  onChange={(e) => {
                    edit();
                    setSummary(e.target.value);
                  }}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  {wordCount(summary)} words
                </p>
              </div>
            )}

            <Textarea
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => {
                edit();
                setNote(e.target.value);
              }}
              rows={2}
            />

            <Button
              type="button"
              onClick={() => submit(verdict)}
              disabled={busy || issues.length === 0}
            >
              Save feedback
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </>
  );
}
