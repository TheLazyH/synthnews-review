"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { Article, Progress, Relation, ReviewItem } from "@/lib/types";

type Confidence = "sure" | "not_sure";

const SKIP_REASONS = [
  { value: "need_context", label: "Need more context" },
  { value: "article_broken", label: "Article missing or broken" },
  { value: "other", label: "Other" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ArticleCard({ label, article }: { label: string; article: Article }) {
  const accent = label === "A" ? "border-l-sky-500" : "border-l-amber-500";
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-l-4 ${accent} bg-background p-5 shadow-sm`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{label}</Badge>
        <Badge variant="outline">{article.source}</Badge>
        {article.category && (
          <Badge variant="secondary">{article.category}</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {formatTime(article.published)}
        </span>
      </div>
      <h2 className="text-lg font-semibold leading-snug">{article.title}</h2>
      <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-foreground/85">
        {article.lead}
      </p>
      {article.url && (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto text-sm font-medium text-sky-700 underline underline-offset-4 dark:text-sky-400"
        >
          Open original ↗
        </a>
      )}
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      className="h-auto justify-start whitespace-normal py-3 text-left"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export default function ReviewScreen({
  slug,
  mode,
}: {
  slug: string;
  mode: "new" | "skipped";
}) {
  const [item, setItem] = useState<ReviewItem | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [same, setSame] = useState<boolean | null>(null);
  const [followUp, setFollowUp] = useState<boolean | null>(null);
  const [opinion, setOpinion] = useState(false);
  const [confidence, setConfidence] = useState<Confidence>("sure");
  const [note, setNote] = useState("");
  const [skipping, setSkipping] = useState(false);
  const startedAt = useRef(Date.now());

  const show = useCallback((next: ReviewItem) => {
    const r = next.review;
    setItem(next);
    setSame(r?.relation ? r.relation === "same_event" : null);
    setFollowUp(
      r?.relation && r.relation !== "same_event"
        ? r.relation === "same_story"
        : null,
    );
    setOpinion(r?.is_opinion ?? false);
    setConfidence(r?.confidence ?? "sure");
    setNote(r?.note ?? "");
    setSkipping(false);
    setFinished(false);
    startedAt.current = Date.now();
    window.scrollTo({ top: 0 });
  }, []);

  const loadNext = useCallback(async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/lists/${slug}/next?mode=${mode}`, {
      cache: "no-store",
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not load the next pair. Refresh the page to retry.");
      return;
    }
    const data = await res.json();
    setProgress(data.progress);
    if (!data.item) {
      setItem(null);
      setFinished(true);
      return;
    }
    show(data.item);
  }, [slug, mode, show]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const relation: Relation | null =
    same === true
      ? "same_event"
      : same === false && followUp !== null
        ? followUp
          ? "same_story"
          : "unrelated"
        : null;

  async function submit(body: Record<string, unknown>) {
    if (!item) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/items/${item.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        time_spent_ms: Date.now() - startedAt.current,
      }),
    });
    if (!res.ok) {
      setBusy(false);
      setError("Save failed. Your answer was not recorded. Please try again.");
      return;
    }
    setHistory((h) => [...h, item.id]);
    await loadNext();
  }

  function save() {
    if (!relation) return;
    submit({ relation, is_opinion: opinion, confidence, note, skipped: false });
  }

  function skip(reason: string) {
    submit({ skipped: true, skip_reason: reason, is_opinion: opinion, note });
  }

  async function back() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/items/${previous}`, { cache: "no-store" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not load the previous pair.");
      return;
    }
    setHistory((h) => h.slice(0, -1));
    show(await res.json());
  }

  const done = progress ? progress.answered + progress.skipped : 0;
  const pct =
    progress && progress.total ? Math.round((done / progress.total) * 100) : 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <Link href={`/lists/${slug}`} className="underline">
            ← List
          </Link>
          {progress && (
            <span className="text-muted-foreground">
              {done} / {progress.total} reviewed
              {progress.skipped ? ` · ${progress.skipped} skipped` : ""}
            </span>
          )}
        </div>
        <div className="h-2 w-full rounded bg-muted">
          <div
            className="h-2 rounded bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {finished ? (
        <div className="space-y-4 rounded-lg border p-6 text-center">
          <p className="text-lg font-semibold">
            {mode === "skipped"
              ? "No skipped pairs left."
              : "All pairs reviewed. Thank you!"}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {history.length > 0 && (
              <Button variant="outline" onClick={back} disabled={busy}>
                ← Change last answer
              </Button>
            )}
            <Button asChild>
              <Link href={`/lists/${slug}`}>Finish and download CSV</Link>
            </Button>
          </div>
        </div>
      ) : !item ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex justify-center">
            <Badge variant="outline">
              Published {item.payload.hours_apart.toFixed(1)} h apart
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ArticleCard label="A" article={item.payload.a} />
            <ArticleCard label="B" article={item.payload.b} />
          </div>

          <section className="space-y-5 rounded-lg border bg-background p-5 shadow-sm">
            <div className="space-y-2">
              <p className="font-medium">
                1. Are both articles reporting the same happening?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice
                  selected={same === true}
                  onClick={() => {
                    setSame(true);
                    setFollowUp(null);
                  }}
                >
                  Yes, the same happening
                </Choice>
                <Choice
                  selected={same === false}
                  onClick={() => setSame(false)}
                >
                  No
                </Choice>
              </div>
            </div>

            {same === false && (
              <div className="space-y-2">
                <p className="font-medium">
                  2. Is one a follow-up, reaction or next step of the other?
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choice
                    selected={followUp === true}
                    onClick={() => setFollowUp(true)}
                  >
                    Yes, the same ongoing story
                  </Choice>
                  <Choice
                    selected={followUp === false}
                    onClick={() => setFollowUp(false)}
                  >
                    No, different events
                  </Choice>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={opinion}
                onCheckedChange={(v) => setOpinion(v === true)}
              />
              One of these is opinion or commentary
            </label>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>How sure are you?</span>
              <Button
                size="sm"
                variant={confidence === "sure" ? "default" : "outline"}
                onClick={() => setConfidence("sure")}
              >
                Sure
              </Button>
              <Button
                size="sm"
                variant={confidence === "not_sure" ? "default" : "outline"}
                onClick={() => setConfidence("not_sure")}
              >
                Not sure
              </Button>
            </div>

            <Textarea
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={!relation || busy}>
                Save and next
              </Button>
              <Button
                variant="outline"
                onClick={back}
                disabled={history.length === 0 || busy}
              >
                ← Back
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSkipping((s) => !s)}
                disabled={busy}
              >
                Skip, can't tell
              </Button>
            </div>

            {skipping && (
              <div className="flex flex-wrap gap-2">
                {SKIP_REASONS.map((r) => (
                  <Button
                    key={r.value}
                    size="sm"
                    variant="secondary"
                    onClick={() => skip(r.value)}
                    disabled={busy}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
