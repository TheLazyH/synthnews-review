import { notFound } from "next/navigation";
import { getCardItems, getList } from "@/lib/review-data";
import { getSession } from "@/lib/session";
import Reader, { type ReaderItem } from "./reader";

const UPDATED = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string; id?: string }>;
}) {
  const { slug } = await params;
  const { c, id } = await searchParams;
  const session = await getSession();
  const list = await getList(slug);
  if (!list || !session || list.kind !== "card") notFound();
  const items: ReaderItem[] = (await getCardItems(list.id, session.sub)).map((item) => ({
    ...item,
    updated: UPDATED.format(new Date(item.payload.published)),
  }));
  return (
    <Reader
      title={list.title}
      items={items}
      initialCategory={c ?? ""}
      initialId={id ?? ""}
    />
  );
}