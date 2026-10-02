import { notFound } from "next/navigation";
import { getList } from "@/lib/review-data";
import ReviewScreen from "./review-screen";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { slug } = await params;
  const { mode } = await searchParams;
  const list = await getList(slug);
  if (!list || list.kind !== "pair") notFound();
  return <ReviewScreen slug={slug} mode={mode === "skipped" ? "skipped" : "new"} />;
}