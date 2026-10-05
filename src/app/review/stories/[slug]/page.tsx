import { notFound } from "next/navigation";
import { getList, getStoryItems } from "@/lib/review-data";
import { getSession } from "@/lib/session";
import StoryReader, { type StoryReaderItem } from "./story-reader";

const WHEN = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function spanLabel(first: string | null, last: string | null) {
  if (!first || !last) return "an unknown period";
  const hours =
    (new Date(last).getTime() - new Date(first).getTime()) / 3_600_000;
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug } = await params;
  const { id } = await searchParams;
  const session = await getSession();
  const list = await getList(slug);
  if (!list || !session || list.kind !== "story") notFound();
  const items: StoryReaderItem[] = (
    await getStoryItems(list.id, session.sub)
  ).map((item) => ({
    ...item,
    span: spanLabel(item.payload.first_seen, item.payload.last_active),
    times: item.payload.timeline.map((e) =>
      e.published ? WHEN.format(new Date(e.published)) : "",
    ),
  }));
  return <StoryReader title={list.title} items={items} initialId={id ?? ""} />;
}
