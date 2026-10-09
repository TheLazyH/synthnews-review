import type { Metadata } from "next";
import { isUuid } from "@/lib/review-data";
import {
  getFeedAround,
  getFeedCategories,
  getPublicCard,
} from "@/lib/public-data";
import { shareMetadata } from "@/lib/share-metadata";
import FeedReader from "./feed-reader";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ card?: string | string[] }>;
}): Promise<Metadata> {
  const { card } = await searchParams;
  if (typeof card !== "string" || !isUuid(card)) return {};
  const found = await getPublicCard(card);
  if (!found) return {};
  return shareMetadata({
    title: found.payload.headline,
    summary: found.payload.summary,
    checking: found.checking,
    path: `/?card=${found.id}`,
  });
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string | string[]; category?: string | string[] }>;
}) {
  const params = await searchParams;
  const categories = await getFeedCategories();
  const rawCategory = typeof params.category === "string" ? params.category : "";
  const category = categories.includes(rawCategory) ? rawCategory : "";
  const card =
    typeof params.card === "string" && isUuid(params.card) ? params.card : "";
  const { page, index } = await getFeedAround({
    category: category || null,
    cardId: card || null,
  });
  return (
    <FeedReader
      initial={page}
      categories={categories}
      category={category}
      categoryParam={!!category}
      requestedCard={card}
      found={index >= 0}
      index={Math.max(index, 0)}
    />
  );
}
