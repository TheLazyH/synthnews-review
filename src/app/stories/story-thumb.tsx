"use client";

import { useState } from "react";
import Image from "next/image";
import type { StoryImage } from "@/lib/public-data";
import CategoryIcon from "./category-icon";

export default function StoryThumb({
  image,
  category,
  className = "",
  iconClassName = "size-6",
  sizes = "72px",
}: {
  image: StoryImage | null;
  category: string | null;
  className?: string;
  iconClassName?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (image && failed !== image.url) {
    return (
      <span
        aria-label={`Image: ${image.credit}`}
        title={`Image: ${image.credit}`}
        className={`relative block shrink-0 overflow-hidden bg-muted ${className}`}
      >
        <Image
          src={image.url}
          alt={`Image: ${image.credit}`}
          fill
          unoptimized
          sizes={sizes}
          referrerPolicy="no-referrer"
          loading="lazy"
          draggable={false}
          onError={() => setFailed(image.url)}
          className="object-cover"
        />
      </span>
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-foreground text-background ${className}`}
    >
      <CategoryIcon category={category} className={iconClassName} />
    </span>
  );
}
