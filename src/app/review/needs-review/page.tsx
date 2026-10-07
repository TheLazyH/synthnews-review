import { notFound } from "next/navigation";
import { formatWhen } from "@/lib/public-data";
import { getNeedsReviewItems } from "@/lib/review-data";
import { getSession } from "@/lib/session";
import Reader, { type ReaderItem } from "../[slug]/reader";

export default async function NeedsReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; id?: string }>;
}) {
  const { c, id } = await searchParams;
  const session = await getSession();
  if (!session) notFound();
  const { items, total } = await getNeedsReviewItems(session.sub);
  const readerItems: ReaderItem[] = items.map((item) => ({
    ...item,
    updated: formatWhen(item.payload.published),
  }));
  return (
    <Reader
      title={`Needs review (${total})`}
      items={readerItems}
      initialCategory={c ?? ""}
      initialId={id ?? ""}
      note={
        total > items.length
          ? `Showing ${items.length} of ${total}, unlabelled first.`
          : "Unlabelled first, newest first."
      }
    />
  );
}
