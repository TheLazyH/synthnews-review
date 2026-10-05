import Link from "next/link";
import { notFound } from "next/navigation";
import CardView from "@/components/card-view";
import { getStoryCards } from "@/lib/public-data";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cards = await getStoryCards(id);
  if (!cards) notFound();
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <Link href="/stories" className="text-sm underline">
        ← All stories
      </Link>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold leading-snug">
          {cards[0].payload.headline}
        </h1>
        <p className="text-sm text-muted-foreground">
          {cards.length} updates, newest first
        </p>
      </header>
      {cards.map((card) => (
        <CardView key={card.id} payload={card.payload} updated={card.updated} />
      ))}
    </main>
  );
}
