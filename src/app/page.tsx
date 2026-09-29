import Link from "next/link";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
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
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `;

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