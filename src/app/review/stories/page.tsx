import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStoryLists } from "@/lib/review-data";

export default async function StoriesIndex() {
  const session = await getSession();
  if (!session) notFound();
  const lists = await getStoryLists();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/review" className="text-sm underline">
        ← Review
      </Link>
      <h1 className="text-xl font-semibold">Stories</h1>

      {lists.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stories yet. Push them with review_push_stories.py.
        </p>
      )}

      <div className="space-y-3">
        {lists.map((l) => (
          <Link
            key={l.slug}
            href={`/review/stories/${l.slug}`}
            className="block rounded-lg border bg-background p-4 shadow-sm transition hover:bg-muted"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">{l.title}</p>
              <span className="shrink-0 text-sm text-muted-foreground">
                {l.total} stories
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
