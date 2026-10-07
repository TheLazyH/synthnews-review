"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const REASONS: { value: string; label: string }[] = [
  { value: "wrong_fact", label: "Wrong fact" },
  { value: "missing_context", label: "Missing context" },
  { value: "outdated", label: "Outdated" },
  { value: "other", label: "Other" },
];

const MAX_NOTE = 280;

export default function ReportSheet({
  cardId,
  onClose,
}: {
  cardId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (!reason || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: cardId, reason, note: note.trim() || null, hp }),
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 202) setSent(true);
    else if (res?.status === 429)
      setError("Too many reports right now. Please try again later.");
    else setError("Couldn't send the report. Please try again.");
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col justify-end bg-black/40"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report an issue"
        className="mx-auto w-full max-w-lg space-y-4 rounded-t-2xl border-t bg-background p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Report an issue</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm">Thanks, we&apos;ll check it.</p>
            <Button type="button" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div role="radiogroup" aria-label="Reason" className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <Button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={reason === r.value}
                  variant={reason === r.value ? "default" : "outline"}
                  onClick={() => setReason(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Textarea
                aria-label="Note (optional)"
                placeholder="Add a note (optional)"
                value={note}
                maxLength={MAX_NOTE}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
              <p className="text-right text-xs tabular-nums text-muted-foreground">
                {note.length} / {MAX_NOTE}
              </p>
            </div>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="absolute -left-[9999px] h-px w-px opacity-0"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="button"
              className="w-full"
              disabled={!reason || busy}
              onClick={send}
            >
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
