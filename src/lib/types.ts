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

export type ListKind = "pair" | "card";

export type CardSource = {
  title: string;
  url: string;
  source: string;
  published: string;
};

export type CardPayload = {
  kind: "card";
  headline: string;
  summary: string;
  sentences: string[];
  category: string | null;
  published: string;
  sources: CardSource[];
};

export type ReadList = {
  slug: string;
  title: string;
  status: "open" | "closed";
  total: number;
};

export type CardVerdict = "good" | "needs_fix" | "wrong";

export type CardIssue = "not_in_sources" | "mixed_events" | "copied" | "bad_headline";

export type MyFeedback = {
  verdict: CardVerdict;
  issues: CardIssue[];
  bad_sentences: number[];
  suggested_title: string | null;
  suggested_summary: string | null;
  note: string | null;
};

export type ReadItem = { id: string; payload: CardPayload; feedback: MyFeedback | null };