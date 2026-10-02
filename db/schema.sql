CREATE TABLE reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  guide_md text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  kind text NOT NULL DEFAULT 'pair' CONSTRAINT lists_kind_check CHECK (kind IN ('pair', 'card')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  position int NOT NULL,
  payload jsonb NOT NULL,
  hidden_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, external_id)
);
CREATE INDEX items_list_position ON items (list_id, position);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES reviewers(id),
  relation text CHECK (relation IN ('same_event', 'same_story', 'unrelated')),
  is_opinion boolean NOT NULL DEFAULT false,
  confidence text CHECK (confidence IN ('sure', 'not_sure')),
  skipped boolean NOT NULL DEFAULT false,
  skip_reason text,
  note text,
  time_spent_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, reviewer_id),
  CHECK ((skipped AND relation IS NULL) OR (NOT skipped AND relation IS NOT NULL))
);

CREATE TABLE card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES reviewers(id),
  verdict text NOT NULL
    CONSTRAINT card_reviews_verdict_check CHECK (verdict IN ('good', 'needs_fix', 'wrong')),
  issues text[] NOT NULL DEFAULT '{}'
    CONSTRAINT card_reviews_issues_check
    CHECK (issues <@ ARRAY['not_in_sources', 'mixed_events', 'copied', 'bad_headline']::text[]),
  bad_sentences int[] NOT NULL DEFAULT '{}'
    CONSTRAINT card_reviews_bad_sentences_check CHECK (0 <= ALL (bad_sentences)),
  suggested_title text,
  suggested_summary text,
  note text,
  time_spent_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, reviewer_id),
  CONSTRAINT card_reviews_good_check CHECK (
    verdict <> 'good' OR (
      cardinality(issues) = 0 AND cardinality(bad_sentences) = 0
      AND suggested_title IS NULL AND suggested_summary IS NULL
    )
  ),
  CONSTRAINT card_reviews_issue_required_check CHECK (verdict = 'good' OR cardinality(issues) >= 1),
  CONSTRAINT card_reviews_sentences_check CHECK (
    cardinality(bad_sentences) = 0 OR 'not_in_sources' = ANY (issues)
  ),
  CONSTRAINT card_reviews_suggestion_check CHECK (
    (suggested_title IS NULL AND suggested_summary IS NULL) OR verdict = 'needs_fix'
  )
);
CREATE INDEX card_reviews_reviewer ON card_reviews (reviewer_id);