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