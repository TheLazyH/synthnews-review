import { isUuid } from "@/lib/review-data";
import { getFeedAround, getFeedCategories } from "@/lib/public-data";
import FeedReader from "./feed-reader";

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
