"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Copy, Forward, MessageCircle, X } from "lucide-react";

type Source = "whatsapp" | "copy_link" | "native";

const TOAST_MS = 1400;

const noSubscribe = () => () => {};

function shareUrl(path: string, source: Source, campaign: "card" | "story") {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

export default function ShareSheet({
  path,
  headline,
  campaign,
  onClose,
}: {
  path: string;
  headline: string;
  campaign: "card" | "story";
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => closeRef.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (manual) manualRef.current?.select();
  }, [manual]);

  function whatsapp() {
    const url = shareUrl(path, "whatsapp", campaign);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${headline}\n${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
    onClose();
  }

  async function copy() {
    const url = shareUrl(path, "copy_link", campaign);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setManual(url);
    }
  }

  async function native() {
    const url = shareUrl(path, "native", campaign);
    try {
      await navigator.share({ title: headline, text: headline, url });
      onClose();
    } catch {
    }
  }

  if (copied) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 bottom-6 z-[95] flex justify-center px-4"
        style={{ bottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <span className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          Link copied
        </span>
      </div>
    );
  }

  const item =
    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-muted";

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
        aria-label="Share"
        className="mx-auto w-full max-w-lg rounded-t-2xl border-t bg-background p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Share</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col">
          <button type="button" onClick={whatsapp} className={item}>
            <MessageCircle className="size-5" aria-hidden="true" />
            WhatsApp
          </button>
          <button type="button" onClick={copy} className={item}>
            <Copy className="size-5" aria-hidden="true" />
            Copy link
          </button>
          {canShare && (
            <button type="button" onClick={native} className={item}>
              <Forward className="size-5" aria-hidden="true" />
              More…
            </button>
          )}
        </div>
        {manual && (
          <div className="space-y-1 pt-3">
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t copy automatically. Select the link and copy it.
            </p>
            <input
              ref={manualRef}
              readOnly
              value={manual}
              aria-label="Link to share"
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
