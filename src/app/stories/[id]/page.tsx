import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getStoryDeck } from "@/lib/public-data";
import { isUuid } from "@/lib/review-data";
import { shareMetadata } from "@/lib/share-metadata";
import StoriesHome from "../stories-home";

export const viewport: Viewport = { viewportFit: "cover" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return {};
  const story = (await getStoryDeck()).find((s) => s.id === id);
  const latest = story?.segments[story.segments.length - 1];
  if (!story || !latest) return {};
  return shareMetadata({
    title: story.headline,
    summary: latest.summary,
    checking: latest.checking,
    path: `/stories/${story.id}`,
  });
}

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
