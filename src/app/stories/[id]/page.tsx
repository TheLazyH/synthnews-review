import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { getStoryDeck } from "@/lib/public-data";
import { isUuid } from "@/lib/review-data";
import StoriesHome from "../stories-home";

export const viewport: Viewport = { viewportFit: "cover" };

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const stories = await getStoryDeck();
  if (!stories.some((s) => s.id === id)) notFound();
  return <StoriesHome stories={stories} openId={id} closeHref="/stories" />;
}
