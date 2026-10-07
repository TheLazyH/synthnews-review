import type { Viewport } from "next";
import { getStoryDeck } from "@/lib/public-data";
import { isUuid } from "@/lib/review-data";
import StoriesHome from "./stories-home";

export const viewport: Viewport = { viewportFit: "cover" };

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const stories = await getStoryDeck();
  const openId =
    s && isUuid(s) && stories.some((story) => story.id === s) ? s : undefined;
  return <StoriesHome stories={stories} openId={openId} />;
}
