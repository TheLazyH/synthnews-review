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