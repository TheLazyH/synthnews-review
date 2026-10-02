import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCardLists } from "@/lib/review-data";

export default async function ReadIndex() {
  const session = await getSession();
  if (!session) notFound();
  const lists = await getCardLists();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/" className="text-sm underline">
        ← Home
      </Link>
      <h1 className="text-xl font-semibold">Read News</h1>

      {lists.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No shorts yet. Push cards with review_push_cards.py.
        </p>
      )}

      <div className="space-y-3">
        {lists.map((l) => (
          <Link
            key={l.slug}
            href={`/read/${l.slug}`}
            className="block rounded-lg border bg-background p-4 shadow-sm transition hover:bg-muted"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">{l.title}</p>
              <span className="shrink-0 text-sm text-muted-foreground">
                {l.total} shorts
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
