# MEMORY.md — SynthNews Review Durable Knowledge Base
Convention: durable facts ONLY — locked decisions, registries, environments,
lessons. NO session narratives. Edit in place when facts change; mark
superseded facts as such rather than deleting silently. Separate memory
space from `synthnews-pipeline` and `ingest` — this covers
`synthnews/synthnews-review/` only, plus the pipeline-side scripts that feed it.

---

## 1. PURPOSE
- Private web app where trusted human reviewers label article pairs. Labels are
  the ground truth for the clustering model (pipeline step 3: features +
  logistic regression) and later for story linking (PIPELINE_V2 stage 2).
- Deliberately separate from `synthnews-pipeline`: the pipeline changes during
  development; the review tool and its labelled data stay stable. The pipeline
  never depends on this app being up.
- Data flow:
  `synthnews-pipeline` sampler → CSV → `review_push.py` → Neon (review DB)
  → reviewers via Vercel app → `review_pull.py` (not built yet) → `data/labels/`.
- Since 2026-10-05 the app has two halves (dev-stage preview):
  - Public news reader (no login, read-only): `/` shorts feed, `/stories`.
  - Review area (login): `/review/...` — card verdicts, story review, pair review.

## 2. LOCKED DECISIONS
- Hosting: Vercel (free), function region `sin1` (Singapore), same region as the DB.
- Database: Neon Postgres (free), SEPARATE from the SynthNews Postgres. The local
  `ingest_postgres` (port 5433) is never exposed to the internet.
- App: Next.js App Router + TypeScript + Tailwind + shadcn/ui (Radix, classic
  preset, Neutral base colour). Single project for pages + API routes.
- DB driver in app: `@neondatabase/serverless` (`neon()` tagged-template `sql`).
- Auth: email + password, accounts created only by admin script
  (`review_user.py`). No public sign-up. bcrypt hashes (`$2b$`, compatible
  between Python `bcrypt` and `bcryptjs`).
- Session: HS256 JWT (`jose`) in httpOnly cookie `review_session`, 7-day expiry,
  `secure` in production, `sameSite=lax`.
- Login lockout: 5 failed attempts → locked 15 min (`failed_logins`,
  `locked_until` on `reviewers`). Unknown email and wrong password return the
  same message (`invalid_credentials`) — never reveal whether an email exists.
- Saving: after EVERY answer (upsert on `unique(item_id, reviewer_id)`), not
  batched. Re-answering accumulates `time_spent_ms`.
- Assignment: every reviewer sees every item (enables agreement measurement).
- Blind review: similarity/weight/bucket live in `items.hidden_meta` and are NEVER
  selected by any query that reaches the browser.
- Items are shuffled on push (seed 11) so reviewers do not see pairs grouped by
  similarity band.
- Backup copy for reviewers: CSV download (UTF-8 BOM for Excel). Email delivery
  is deferred (phase 5).
- Search engines blocked: `robots: { index: false, follow: false }` in layout
  metadata + `public/robots.txt` disallow all.
- Public routes (allowlist in `src/proxy.ts`): `/`, `/stories`, `/stories/:id`,
  `/api/feed`, GET/HEAD only. Every other path and method needs a session
  (logged-out pages → `/login`, `/api/*` → 401). Server Functions arrive as
  POSTs to page paths, so public pages must stay GET-only.
- Public reader shows ONLY cards with `hidden_meta.card_status = 'active'` and
  selects `payload` only; `hidden_meta` contents never reach the browser.
- Public stories: latest story-list version per `story_id`; counts and shows
  only active linked cards; hidden unless ≥ 2 active cards.
- Light mode only (no dark toggle). Text-size control kept.
- Code style: no comments or docstrings in delivered code (eslint-disable
  lines excepted). No hard-coded word
  lists anywhere (standing SynthNews rule).

## 3. LABEL DEFINITIONS (the reviewing rule)
Guided flow in the UI; stored values in `reviews.relation`:

| Stored value | Meaning | Example |
|---|---|---|
| `same_event` | Both report the same happening; one card could hold both. Includes aftermath/forecast pieces whose core facts are the original event | Two reports on the same landslide rescue |
| `same_story` | Different happenings on one thread: reaction, reply, follow-up, next step | An announcement, then a party's reaction |
| `unrelated` | Different events, even with the same people/court/party | Two cases before the same SC bench |

- `is_opinion = true` when one side is commentary/opinion (relation is then
  normally `unrelated`).
- `confidence`: `sure` | `not_sure`. Skips store `relation = NULL`,
  `skipped = true`, `skip_reason` ∈ `need_context | article_broken | other`.
- Live blogs / daily briefs ("India news LIVE", "HT Evening Brief") → `unrelated`.
  Whether to exclude them from clustering entirely is an open pipeline decision.
- Model use: step 3 trains `same_event` vs everything else; `same_story` labels
  are kept for PIPELINE_V2 stage 2.

## 4. SCHEMA REGISTRY (Neon, `public`)
Source of truth: `db/schema.sql` in this repo. No migration tool; schema changes
are applied by hand (see Lessons §9).

### `reviewers`
id uuid PK · name · email UNIQUE (stored lowercase) · password_hash · is_admin ·
active · failed_logins · locked_until · created_at

### `lists`
id uuid PK · slug UNIQUE · title · description · guide_md (plain text, rendered
with `whitespace-pre-wrap`; NULL → built-in `PairGuide`) · status `open|closed` ·
kind `pair|card|story` (default `pair`) · created_at
- Card list slugs: `cards-YYYY-MM-DD`.

### `items`
id uuid PK · list_id FK (cascade) · external_id (pipeline `pair_id`) · position ·
payload jsonb · hidden_meta jsonb · created_at · UNIQUE(list_id, external_id) ·
index (list_id, position)
- `payload` = `{a: Article, b: Article, hours_apart}`;
  `Article` = `{title, lead (≤800 chars), url, source, published (ISO), category}`.
- `hidden_meta` = `{bucket, sim, shared_weight, shared_entities}`.
- Above is for `kind = 'pair'`. Other kinds:
  - card `payload` = `{kind:"card", headline, summary, sentences[], category,
    published, image: {url, credit} | null, sources[]}`; source =
    `{title, url, source (domain), published, image_url | null}`, ordered
    earliest first. `image`/`image_url` are optional in the TS types.
  - card `hidden_meta` = `{card_status: active|needs_review, cluster_id,
    created_at, model_id, prompt_version}`.
  - story `payload` = `{kind:"story", headline, category, first_seen,
    last_active, cluster_count, source_count, timeline[]}`; timeline entry =
    `{published, headline, summary, sentences[], sources[]}` (no images).
  - story `hidden_meta` = `{story_id, card_ids[], card_statuses[], cluster_ids[],
    prompt_versions[]}`. Story `external_id` = `story_id`.
  - Link story → cards: `hidden_meta.card_ids[i]` = card `items.external_id`
    (NOT `items.id`); `cluster_ids` = card `hidden_meta.cluster_id`.
    Cards carry no story id.

### `card_reviews` / `story_reviews`
Per-reviewer verdicts on card / story items, `UNIQUE(item_id, reviewer_id)`.
card: verdict `good|needs_fix|wrong`, issues[], bad_sentences[],
suggested_title/summary, note. story: verdict
`good|wrong_link|series_not_story|missing_link`, bad_entries[], note.

### `reviews`
id uuid PK · item_id FK (cascade) · reviewer_id FK · relation · is_opinion ·
confidence · skipped · skip_reason · note (≤1000 chars) · time_spent_ms
(capped 1h per save) · created_at · updated_at · UNIQUE(item_id, reviewer_id) ·
CHECK skipped ⇔ relation IS NULL

### Current data
- List `cluster-pairs-2026-09-29` — "Clustering pairs — 29 Sep", 82 items, from
  `synthnews-pipeline/data/labels/pairs_20260929.csv`.
- As of 2026-10-05: 5 pair lists, 8 card lists (236 cards, 167 active),
  3 story lists (24 stories, 10 with ≥ 2 active cards).
- Reviewers: `harshitsahni20@gmail.com` (Harshit, admin). Second reviewer to be
  registered.

## 5. ENVIRONMENTS
### Neon
- Project `synthnews-review`, region AWS `ap-southeast-1` (Singapore).
- Endpoint `ep-long-wildflower-b30jv6qd`, POOLED host
  (`...-pooler.c-4.ap-southeast-1.aws.neon.tech`), database `neondb`, role
  `neondb_owner`, `sslmode=require&channel_binding=require`.
- Never write the password into any file that is committed or pasted.

### Env vars
| Where | Key | Value |
|---|---|---|
| `synthnews-review/.env.local` (git-ignored) | `DATABASE_URL` | Neon pooled string |
| same | `SESSION_SECRET` | `openssl rand -base64 32` |
| Vercel project settings | both of the above | same values |
| `synthnews-pipeline/.env` | `REVIEW_DATABASE_URL` | Neon pooled string |

### GitHub
- Repo `TheLazyH/synthnews-review`, private (renamed from the typo
  `sythnews-review`).
- Remote: `git@github-personal:TheLazyH/synthnews-review.git`.
- SSH on this Mac (`~/.ssh/config`):
  - `Host github.com` → `~/.ssh/id_ed25519` → account **harshit20mdeal**
    (Monetize Deal work), `IdentitiesOnly yes`.
  - `Host github-personal` → `~/.ssh/id_ed25519_personal` → account **TheLazyH**
    (all SynthNews repos).
  - `id_ed25519_thelazyh` / `Host github-thelazyh` was a duplicate TheLazyH key;
    removal was proposed — confirm with `grep -n Host ~/.ssh/config`.
- Check: `ssh -T git@github.com` → harshit20mdeal; `ssh -T git@github-personal`
  → TheLazyH.
- Commit identity for SynthNews: TheLazyH / `harshitsahni15@gmail.com`, via
  `includeIf "gitdir:~/Documents/synthnews/"` → `~/.gitconfig-synthnews`
  (verify with `git config user.email` inside a SynthNews repo).

### Vercel
- Imported from TheLazyH's GitHub; auto-deploys on push to `main`.
- Settings → Functions → Function Region = `sin1`.

### Local dev
- `cd ~/Documents/synthnews/synthnews-review && npm run dev` → `http://localhost:3000`.
- `npm run build` must pass before pushing (catches type errors).

## 6. CODEBASE MAP (`synthnews-review/`)
```
db/schema.sql                         schema source of truth
public/robots.txt                     disallow all
next.config.ts                        redirects: /read/:path* → /review/:path*, /lists/:slug → /review/pairs/:slug
src/proxy.ts                          route guard + public allowlist (Next 16: proxy.ts / export proxy)
src/lib/db.ts                         neon() sql client
src/lib/token.ts                      JWT sign/verify, SESSION_COOKIE (edge-safe, no next/headers)
src/lib/session.ts                    create/get/clear session via cookies()
src/lib/types.ts                      pair, card, story payload + feedback types
src/lib/review-data.ts                review queries (lists, items + my feedback), isUuid
src/lib/public-data.ts                public queries: getFeed (keyset), getFeedAround, getFeedCategories,
                                      getStories, getStoryCards, parseFeedQuery
src/app/layout.tsx                    metadata (noindex), PREFS_SCRIPT (text size), SiteHeader, ReadingControls
src/components/site-header.tsx        SynthNews · Feed · Stories · Login | Review + Logout
src/components/card-view.tsx          shared card: category band + image carousel, headline, sentences, source chips
src/components/shorts-nav.tsx         ShortsNav (fixed ↑/↓) + useShortsKeys (arrows; j/k opt-in)
src/components/logout-button.tsx      Logout
src/components/reading-controls.tsx   text size (100/112/125%)

PUBLIC
src/app/page.tsx                      / — server: categories + getFeedAround(?category, ?card)
src/app/feed-reader.tsx               one-card shorts reader: chips, prefetch, caught-up, wheel/swipe/keys,
                                      sessionStorage restore
src/app/stories/page.tsx              /stories — stories with ≥ 2 active cards
src/app/stories/[id]/page.tsx         /stories/:story_id — active cards, newest first
src/app/api/feed/route.ts             GET only; ?category ?cursor ?limit (≤ 50); bad input → 400

REVIEW (login)
src/app/review/page.tsx               dashboard: card dates, story lists, pair lists
src/app/review/[slug]/                card reader with verdicts (reader.tsx, short-view.tsx)
src/app/review/stories/               story lists + timeline review
src/app/review/pairs/[slug]/page.tsx  pair list: progress, Start/Continue, skipped, CSV, guide
src/app/review/pairs/[slug]/run/      pair review screen (mode=new|skipped)
src/app/login/page.tsx                login form → /review

API (login unless noted)
src/app/api/auth/login|logout         POST (login is public)
src/app/api/lists/[slug]/next|export  pair next item / CSV
src/app/api/items/[id](/review)       pair item GET / POST review
src/app/api/read/items/[id]/feedback       POST card verdict
src/app/api/read/items/[id]/story-feedback POST story verdict
```
- SUPERSEDED 2026-10-05: `/` was the logged-in dashboard, `/read/...` the card
  and story review, `/lists/:slug` + `/review/:slug` the pair flow. Old pair
  `/review/:slug` links are intentionally broken.
- Next.js 15+: route `params` / `searchParams` are Promises — always `await`.
- Browser prefs in localStorage: `textScale` (`100|112|125`), applied pre-paint by
  `PREFS_SCRIPT` (hence `suppressHydrationWarning` on `<html>`). `theme` is
  no longer read (SUPERSEDED: dark mode removed 2026-10-05).
- Feed reader state in sessionStorage `feed-state:v1` (category, loaded cards,
  next cursor, index, savedAt; 30-min expiry). URL mirrors `?category=&card=`.
- Feed cursor = `<published ISO, microseconds, UTC>_<items.id>`; order
  `published DESC, id DESC`.
- Images: plain `<img>` with `referrerPolicy="no-referrer"` (publisher hotlinks),
  not `next/image`.
- Card accents: A = `border-l-sky-500`, B = `border-l-amber-500`.

## 7. PIPELINE-SIDE PIECES (`synthnews-pipeline/`)
- `core/config.py`: `Settings` uses `SettingsConfigDict(env_file=".env")`;
  field `review_database_url: str | None = None`; object name `settings`.
- Dependency: `bcrypt` (added with `uv add bcrypt`).
- `scripts/cluster_sample.py` — pairs from last 72h, same category, ≤48h apart,
  sim ≥ 0.60; buckets sim 0.60–0.70 / 0.70–0.78 / 0.78–0.86 / 0.86–0.93 / ≥0.93
  (15 each, seed 7) + `shared_cast` (top shared-entity weight below 0.86).
  Output `data/labels/pairs_YYYYMMDD.csv`.
- `scripts/review_user.py` — register / reset password / `--deactivate`.
- `scripts/review_push.py` — CSV → list + items. Re-reads article url, category,
  source domain and an 800-char lead from the MAIN DB by `a_id`/`b_id`, so the
  local `ingest_postgres` must be running. Idempotent (existing `external_id`s
  are skipped).
- `scripts/label_pairs.py` — terminal labeller; SUPERSEDED by this app.

### Commands (run in `synthnews-pipeline`)
```bash
PYTHONPATH=. uv run python scripts/review_user.py --email <email> --name "<Name>" [--admin]
PYTHONPATH=. uv run python scripts/review_user.py --email <email> --deactivate
PYTHONPATH=. uv run python scripts/cluster_sample.py
PYTHONPATH=. uv run python scripts/review_push.py data/labels/pairs_YYYYMMDD.csv \
  --slug <slug> --title "<Title>" --description "<text>"
```
- Close a list (no UI yet): `UPDATE lists SET status = 'closed' WHERE slug = '<slug>';`

## 8. OPEN / NOT YET DONE
- Phase 4: `scripts/review_pull.py` — export all reviews for a list to
  `data/labels/<slug>_labels.csv`, counts per label, skips, inter-reviewer
  agreement, and list of disagreeing pairs.
- Phase 5 (optional): email the CSV to the reviewer (e.g. Resend free tier).
- Register second reviewer; both label all 82 pairs independently.
- Clear any test answers before real labelling (DELETE from `reviews` for the
  reviewer).
- No admin UI (users, lists, closing) — all via scripts/SQL.
- No keyboard shortcuts in the pair review screen (card reader has ↑/↓).
- Public feed does not collapse cards of the same story, and does not
  de-duplicate a card that appears in two card lists (none today).
- Deep link `?card=` is only found within the first 200 cards of a category.
- `npm run lint` has 13 known problems in older files (react-hooks purity /
  set-state-in-effect, unescaped quotes, one `any`); new code lints clean.
- `guide_md` is shown as plain text, not rendered Markdown.
- Sampler CSV has no URL columns (push fetches them); add `a_url`/`b_url` to the
  sampler if CSVs are ever reviewed outside the app.

## 9. LESSONS
- Neon SQL Editor can run against a different branch/database than the app's
  connection string → tables "missing". Apply schema THROUGH the same
  connection string (pipeline heredoc with `engine.begin()`), then list
  `information_schema.tables` to confirm `items, lists, reviewers, reviews`.
- `create_engine(...).begin().__enter__()` in a one-liner closes the connection
  before use ("This Connection is closed"). Use a heredoc with a real `with` block.
- SQLAlchemy `session.rollback()` expires loaded ORM objects; reading them after
  the session closes raises `DetachedInstanceError`. Read-only scripts should not
  roll back before using results.
- zsh: `!` inside double quotes triggers history expansion ("event not found").
  Use single quotes. Never put `# comments` on the same line as a pasted command.
- `review_push.py` failing with "connection refused … port 5433" = local Docker
  DB stopped. `cd ~/Documents/synthnews/ingest && docker compose up -d`.
- GitHub: one SSH public key can belong to ONE account only. A private repo you
  cannot access is reported as "Repository not found" — check the account
  (`ssh -T`) and the exact repo name (`git ls-remote`) before anything else.
- GitHub HTTPS rejects account passwords; use a token. `AddKeysToAgent` can make
  plain `github.com` authenticate as the wrong account — pin `Host github.com`
  with `IdentityFile` + `IdentitiesOnly yes`.
- VS Code/Pylance hover text or "Expected N arguments" on freshly edited files is
  often stale analysis — trust `npm run build` / `pytest`, restart the language
  server if needed.
- Renamed/moved routes leave stale generated types in `.next/types` and
  `.next/dev/types` → `tsc` "Cannot find module …/page.js". Run
  `npx next typegen` and delete `.next/dev/types` (recreated by `next dev`).
- `git mv src/x src/y` when `src/y` already exists (even empty) nests it as
  `src/y/x`. Check the tree after moves.
- eslint `react-hooks/set-state-in-effect` follows calls into helpers: start
  fetches inside the effect and set state in `.then`, not via a helper that
  sets state before awaiting.
- JS `Date` rolls invalid dates over (Feb 30 → Mar 2) where Postgres errors →
  validate user dates by round-trip (`toISOString()` equals input).
- Neon offers optional CLI onboarding (`neon login`, `neon mcp`, `neon deploy`) —
  NOT used; only the pooled connection string is needed.