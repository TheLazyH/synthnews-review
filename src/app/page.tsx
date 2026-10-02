import Link from "next/link";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCardLists } from "@/lib/review-data";
import LogoutButton from "./logout-button";

export default async function Home() {
  const session = await getSession();
  const lists = await sql`
    SELECT l.slug, l.title, l.description, l.status,
           count(i.id)::int AS total,
           (count(r.id) FILTER (WHERE NOT r.skipped))::int AS answered,
           (count(r.id) FILTER (WHERE r.skipped))::int AS skipped
    FROM lists l
    LEFT JOIN items i ON i.list_id = l.id
    LEFT JOIN reviews r ON r.item_id = i.id AND r.reviewer_id = ${session!.sub}
    WHERE l.kind = 'pair'
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `;
  const cardLists = await getCardLists();
  const latest = cardLists[0];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">SynthNews Review</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {session?.name} ({session?.email})
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Read News</h2>
          {cardLists.length > 0 && (
            <Link href="/read" className="text-sm underline">
              All dates
            </Link>
          )}
        </div>
        {latest ? (
          <Link
            href={`/read/${latest.slug}`}
            className="block rounded-lg border bg-background p-4 shadow-sm transition hover:bg-muted"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">{latest.title}</p>
              <span className="shrink-0 text-sm text-muted-foreground">
                {latest.total} shorts
              </span>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No shorts yet.</p>
        )}
      </section>

      <h2 className="text-lg font-semibold">Cluster review</h2>

      {lists.length === 0 && (
        <p className="text-sm text-muted-foreground">No review lists yet.</p>
      )}
      <div className="space-y-3">
        {lists.map((l) => {
          const done = l.answered + l.skipped;
          return (
            <Link
              key={l.slug}
              href={`/lists/${l.slug}`}
              className="block rounded-lg border bg-background p-4 shadow-sm transition hover:bg-muted"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{l.title}</p>
                  {l.description && (
                    <p className="text-sm text-muted-foreground">{l.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {done} / {l.total}
                  {l.status === "closed" ? " · closed" : ""}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}