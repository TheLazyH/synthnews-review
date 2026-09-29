"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SCALES = [100, 112, 125];

export default function ReadingControls() {
  const [dark, setDark] = useState(false);
  const [scale, setScale] = useState(100);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const saved = Number(localStorage.getItem("textScale"));
    if (SCALES.includes(saved)) setScale(saved);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function cycleScale() {
    const next = SCALES[(SCALES.indexOf(scale) + 1) % SCALES.length];
    setScale(next);
    document.documentElement.style.fontSize = `${next}%`;
    localStorage.setItem("textScale", String(next));
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-1 rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur">
      <Button size="sm" variant="ghost" className="rounded-full" onClick={cycleScale} aria-label="Change text size">
        A {scale}%
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full" onClick={toggleTheme} aria-label="Toggle dark mode">
        {dark ? "☀ Light" : "☾ Dark"}
      </Button>
    </div>
  );
}