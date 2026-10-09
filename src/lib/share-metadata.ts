import type { Metadata } from "next";
import { headers } from "next/headers";

const DESCRIPTION_MAX = 160;
const CHECKING_NOTE = " · Some details still being checked";
const HOST_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

export function shareDescription(summary: string, checking: boolean): string {
  const suffix = checking ? CHECKING_NOTE : "";
  const room = DESCRIPTION_MAX - suffix.length;
  const text = summary.replace(/\s+/g, " ").trim();
  if (text.length <= room) return text + suffix;
  const cut = text.slice(0, room - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > room / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, "")}…${suffix}`;
}

async function requestOrigin(): Promise<URL | undefined> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!HOST_RE.test(host)) return undefined;
  const forwarded = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const proto =
    forwarded === "http" || forwarded === "https"
      ? forwarded
      : /^(localhost|127\.0\.0\.1)(:|$)/.test(host)
        ? "http"
        : "https";
  return new URL(`${proto}://${host}`);
}

export async function shareMetadata({
  title,
  summary,
  checking,
  path,
}: {
  title: string;
  summary: string;
  checking: boolean;
  path: string;
}): Promise<Metadata> {
  const description = shareDescription(summary, checking);
  const image = { url: "/og.png", width: 1200, height: 630, alt: "SynthNews" };
  return {
    metadataBase: await requestOrigin(),
    title,
    description,
    openGraph: {
      title,
      description,
      url: path,
      siteName: "SynthNews",
      type: "article",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
