"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SCALES = [100, 112, 125];

export default function ReadingControls() {
  const [scale, setScale] = useState(100);

  useEffect(() => {
    const saved = Number(localStorage.getItem("textScale"));
    if (SCALES.includes(saved)) setScale(saved);
  }, []);

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
    </div>
  );
}