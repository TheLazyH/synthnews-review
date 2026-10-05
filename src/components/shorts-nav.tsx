"use client";

import { useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

export function useShortsKeys(go: (step: number) => void, vimKeys = false) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
      if (e.key === "ArrowDown" || (vimKeys && plain && e.key === "j")) {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp" || (vimKeys && plain && e.key === "k")) {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, vimKeys]);
}

export default function ShortsNav({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <nav
      aria-label="Move between shorts"
      className="fixed bottom-4 left-4 z-40 flex flex-row gap-2 rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur md:bottom-auto md:left-auto md:right-8 md:top-1/2 md:-translate-y-1/2 md:flex-col"
    >
      <Button
        size="icon"
        variant="ghost"
        className="size-14 touch-manipulation rounded-full md:size-11 [&_svg:not([class*='size-'])]:size-7 md:[&_svg:not([class*='size-'])]:size-6"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous short"
      >
        <ChevronUpIcon />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-14 touch-manipulation rounded-full md:size-11 [&_svg:not([class*='size-'])]:size-7 md:[&_svg:not([class*='size-'])]:size-6"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next short"
      >
        <ChevronDownIcon />
      </Button>
    </nav>
  );
}
