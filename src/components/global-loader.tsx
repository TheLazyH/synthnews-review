"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";

const SAFETY_TIMEOUT_MS = 15_000;

let pending = false;
const listeners = new Set<() => void>();

function setPending(value: boolean) {
  if (pending === value) return;
  pending = value;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startLoading() {
  setPending(true);
}

export function stopLoading() {
  setPending(false);
}

function navigationTarget(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return null;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement)) return null;
  if ((a.target && a.target !== "_self") || a.hasAttribute("download"))
    return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/"))
    return null;
  if (url.pathname === location.pathname && url.search === location.search)
    return null;
  return url;
}

function RouteWatcher() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    stopLoading();
  }, [pathname, search]);
  return null;
}

export default function GlobalLoader() {
  const active = useSyncExternalStore(
    subscribe,
    () => pending,
    () => false,
  );

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (navigationTarget(e)) startLoading();
    }
    // Capture phase so this runs before <Link> handles the click.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", stopLoading);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", stopLoading);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(stopLoading, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <>
      <Suspense fallback={null}>
        <RouteWatcher />
      </Suspense>
      {active && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] cursor-wait touch-none"
        >
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-primary/10">
            <div className="h-full w-1/3 animate-[loader-slide_1s_ease-in-out_infinite] bg-primary" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 animate-[loader-fade_200ms_150ms_forwards]">
            <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
          </div>
          <span className="sr-only">Loading</span>
        </div>
      )}
    </>
  );
}

export function PageLoader() {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <Loader2Icon className="size-10 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
