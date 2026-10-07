"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CardView, { wordCount } from "@/components/card-view";
import type {
  CardIssue,
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

export default function ShortView({
  item,
  saved,
  onSaved,
}: {
  item: ReaderItem;
  saved: MyFeedback | null;
  onSaved: (feedback: MyFeedback) => void;
}) {
  const { headline, sentences } = item.payload;
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
      {(item.status === "needs_review" || item.listTitle) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {item.status === "needs_review" && (
            <Badge variant="destructive">Needs review</Badge>
          )}
          {item.listTitle && <span>{item.listTitle}</span>}
        </div>
      )}
      <CardView
        payload={item.payload}
        updated={item.updated}
        marking={marking}
        badSentences={badSentences}
        onToggleSentence={toggleSentence}
      />

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
