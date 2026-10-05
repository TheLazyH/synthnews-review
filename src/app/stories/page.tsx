import Link from "next/link";
import { getStories } from "@/lib/public-data";

export default async function StoriesPage() {
  const stories = await getStories();
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Stories</h1>
      {stories.length === 0 && (
        <p className="text-sm text-muted-foreground">No stories yet.</p>
      )}
      <div className="space-y-3">
        {stories.map((s) => (
          <Link
            key={s.id}
            href={`/stories/${s.id}`}
            className="block space-y-1 rounded-lg border bg-background p-4 shadow-sm transition hover:bg-muted"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.category ?? "News"}
            </p>
            <p className="font-medium leading-snug">{s.headline}</p>
            <p className="text-xs text-muted-foreground">
              {s.updates} updates · Updated {s.lastUpdated} IST
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
