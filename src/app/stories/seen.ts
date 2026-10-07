import { useMemo, useSyncExternalStore } from "react";

const KEY = "storiesSeen";
const EVENT = "stories-seen";
const MAX = 2000;

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function markSeen(id: string) {
  const seen = parse(readRaw());
  if (seen.has(id)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...seen, id].slice(-MAX)));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useSeen(): Set<string> {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return useMemo(() => parse(raw), [raw]);
}
