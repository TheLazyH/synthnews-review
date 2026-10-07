export type Article = {
  title: string;
  lead: string;
  url: string | null;
  source: string;
  published: string;
  category: string | null;
};

export type ItemPayload = { a: Article; b: Article; hours_apart: number };

export type Relation = "same_event" | "same_story" | "unrelated";

export type MyReview = {
  relation: Relation | null;
  is_opinion: boolean;
  confidence: "sure" | "not_sure" | null;
  skipped: boolean;
  skip_reason: string | null;
  note: string | null;
};

export type ReviewItem = {
  id: string;
  position: number;
  payload: ItemPayload;
  review: MyReview | null;
};

export type Progress = { total: number; answered: number; skipped: number };

export type ListKind = "pair" | "card" | "story";

export type CardSource = {
  title: string;
  url: string;
  source: string;
  published: string;
  image_url?: string | null;
};

export type CardImage = { url: string; credit: string };

export type CardPayload = {
  kind: "card";
  headline: string;
  summary: string;
  sentences: string[];
  category: string | null;
  published: string;
  sources: CardSource[];
  image?: CardImage | null;
};

export type ReadList = {
  slug: string;
  title: string;
  status: "open" | "closed";
  total: number;
};

export type CardList = ReadList & { needs_review: number };

export type CardStatus = "active" | "needs_review";

export type StatusFilter = "all" | CardStatus;

export type CardVerdict = "good" | "needs_fix" | "wrong";

export type CardIssue =
  | "not_in_sources"
  | "mixed_events"
  | "copied"
  | "bad_headline";

export type MyFeedback = {
  verdict: CardVerdict;
  issues: CardIssue[];
  bad_sentences: number[];
  suggested_title: string | null;
  suggested_summary: string | null;
  note: string | null;
};

export type ReadItem = {
  id: string;
  payload: CardPayload;
  status: CardStatus;
  listTitle?: string;
  feedback: MyFeedback | null;
};

export type StorySource = {
  title: string;
  url: string;
  source: string;
  published: string | null;
};

export type StoryEntry = {
  published: string | null;
  headline: string;
  summary: string;
  sentences: string[];
  sources: StorySource[];
};

export type StoryPayload = {
  kind: "story";
  headline: string;
  category: string | null;
  first_seen: string | null;
  last_active: string | null;
  cluster_count: number;
  source_count: number;
  timeline: StoryEntry[];
};

export type StoryVerdict =
  | "good"
  | "wrong_link"
  | "series_not_story"
  | "missing_link";

export type MyStoryFeedback = {
  verdict: StoryVerdict;
  bad_entries: number[];
  note: string | null;
};

export type StoryItem = {
  id: string;
  payload: StoryPayload;
  feedback: MyStoryFeedback | null;
};
