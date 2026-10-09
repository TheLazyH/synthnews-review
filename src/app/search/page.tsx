import type { Metadata } from "next";
import {
  SEARCH_MIN_OUTLETS,
  SEARCH_TIMES,
  getFeedCategories,
  type SearchTime,
} from "@/lib/public-data";
import SearchView, { type SearchState } from "./search-view";

export const metadata: Metadata = { title: "Search · SynthNews" };

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

function many(v: string | string[] | undefined): string[] {
  return (Array.isArray(v) ? v : v ? [v] : []).filter((o) =>
    /^[a-z0-9][a-z0-9.-]{0,99}$/i.test(o),
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const categories = await getFeedCategories();
  const category = one(params.category);
  const time = one(params.time);
  const min = Number(one(params.min_outlets));
  const sort = one(params.sort);
  const initial: SearchState = {
    q: one(params.q).trim().slice(0, 100),
    category: categories.includes(category) ? category : "",
    time: (SEARCH_TIMES as readonly string[]).includes(time)
      ? (time as SearchTime)
      : "any",
    outlets: [...new Set(many(params.outlet).map((o) => o.toLowerCase()))].slice(0, 10),
    minOutlets: (SEARCH_MIN_OUTLETS as readonly number[]).includes(min) ? min : null,
    confirmed: one(params.confirmed) === "true",
    sort: sort === "relevance" || sort === "newest" ? sort : "",
  };
  return <SearchView categories={categories} initial={initial} />;
}
