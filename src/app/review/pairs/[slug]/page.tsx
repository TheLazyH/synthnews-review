import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import PairGuide from "@/components/pair-guide";
import { getSession } from "@/lib/session";
import { getList, getProgress } from "@/lib/review-data";

export default async function ListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  const list = await getList(slug);
  if (!list || !session || list.kind !== "pair") notFound();
  if (!list || !session) notFound();
  const progress = await getProgress(list.id, session.sub);
  const done = progress.answered + progress.skipped;
  const remaining = progress.total - done;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/review" className="text-sm underline">
        ← All lists
      </Link>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{list.title}</h1>
        {list.description && (
          <p className="text-muted-foreground">{list.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {progress.answered} answered · {progress.skipped} skipped ·{" "}
          {remaining} remaining
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {remaining > 0 && list.status === "open" && (
          <Button asChild>
            <Link href={`/review/pairs/${slug}/run`}>
              {done === 0 ? "Start reviewing" : "Continue"}
            </Link>
          </Button>
        )}
        {progress.skipped > 0 && list.status === "open" && (
          <Button asChild variant="outline">
            <Link href={`/review/pairs/${slug}/run?mode=skipped`}>
              Review skipped ({progress.skipped})
            </Link>
          </Button>
        )}
        {done > 0 && (
          <Button asChild variant="outline">
            <a href={`/api/lists/${slug}/export`}>Download my CSV</a>
          </Button>
        )}
      </div>

      <section className="rounded-lg border bg-background p-4 shadow-sm">
        <h2 className="mb-3 font-medium">How to review</h2>
        {list.guide_md ? (
          <p className="whitespace-pre-wrap text-sm">{list.guide_md}</p>
        ) : (
          <PairGuide />
        )}
      </section>
    </main>
  );
}
