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
  return <ReviewScreen slug={slug} mode={mode === "skipped" ? "skipped" : "new"} />;
}