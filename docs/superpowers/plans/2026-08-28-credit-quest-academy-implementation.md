# Credit Quest V2.1 Academy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public and personalised Credit Quest Academy backed by Supabase, with at least 25 reviewed launch articles, deterministic safe topic selection, a seventh finite Quest Feed card, public SEO routes, and authenticated learning progress/analytics without allowing Academy or commercial data to influence credit strategy.

**Architecture:** Add an isolated `lib/academy` domain for content contracts and deterministic selection, a Supabase-backed Academy repository and additive schema, public `/learn` routes, and small Academy presentation/tracking components. Production content is read from published Supabase rows; demo mode uses a small reviewed fixture only when Supabase is not configured. The dependency direction stays one-way: profile/safety/diagnosis/passport/readiness/mission ranking -> Academy selector -> education presentation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Supabase Auth/Postgres/RLS, Zod 3, Vitest 3, Testing Library, Playwright. Do not add a Markdown dependency; render a deliberately restricted Markdown subset with React so raw HTML/scripts are never executed.

**Spec:** `docs/superpowers/specs/2026-08-28-credit-quest-academy-design.md`

## Global Constraints

- Academy is downstream of age, safety, diagnosis, Credit Passport, Application Readiness and mission ranking.
- Academy viewing/completion/content metadata must never alter safety, diagnosis, Passport, Readiness, mission ranking, offer matching or offer suppression.
- Affiliate commission, CPA/CPL payout, EPC, partner priority, campaign economics, sponsored inventory and provider commercial preference are forbidden selector inputs.
- Under-18 filtering and Safe Mode filtering happen before relevance scoring.
- Under-18 users only receive `under18_safe` Academy content and no product/application encouragement.
- Safe Mode users only receive `safe_mode_safe` Academy content and no inappropriate borrowing/application encouragement.
- Raw HTML, JavaScript, iframes and arbitrary embeds are unsupported in article bodies.
- Public queries return only `status = 'published'` article versions.
- Published content is versioned; material edits create a new row rather than silently rewriting a live version.
- Direct browser writes to Academy content and Academy progress are denied.
- Progress failures and Academy read failures must not break missions, Passport or Readiness.
- The Quest Feed remains finite; it grows from 6 to 7 cards and does not add infinite scrolling, streaks, autoplay or fake urgency.
- Launch content contains at least 25 substantive reviewed entries, including one normal-adult fallback, one `under18_safe` fallback and one `safe_mode_safe` fallback.
- Every production change follows RED -> GREEN -> refactor with an observed failing test first.
- Database work follows additive expand -> deploy -> verify discipline; no destructive cutover is required.

---

## File map

### New Academy domain/content files
- `lib/academy/types.ts` — serialisable Academy article/progress/selection contracts and controlled vocabularies.
- `lib/academy/selector.ts` — pure protective filtering + deterministic relevance ranking.
- `lib/academy/demo-content.ts` — reviewed demo/test fixture used only when Supabase is not configured.
- `lib/academy/markdown.tsx` — restricted Markdown renderer with no raw HTML execution and HTTPS-only external links.

### New server/data files
- `lib/server/academy-repository.ts` — map/query published articles, exact published-article lookup, related-content ranking, user progress reads/writes and publish RPC wrapper.
- `lib/supabase/admin.ts` — service-role client used only in server code.
- `supabase/migrations/007_academy.sql` — Academy schema, RLS, indexes and atomic publish function.
- `supabase/migrations/008_academy_launch_content.sql` — 25+ reviewed published launch entries.

### New presentation/routes
- `components/academy/academy-card.tsx` — `Learn in 20 seconds` Quest Feed card.
- `components/academy/academy-library.tsx` — public browse/search results plus explicit unavailable state.
- `components/academy/academy-article.tsx` — provenance + safe Markdown article presentation.
- `components/academy/academy-tracker.tsx` — best-effort shown/opened/completed/still-confused/search tracking and progress writes.
- `app/learn/page.tsx` — public Academy browse/search route.
- `app/learn/[slug]/page.tsx` — public article route with metadata and real not-found behaviour.
- `app/api/academy/progress/route.ts` — authenticated server-owned progress write endpoint.
- `app/sitemap.ts` — published Academy URLs only.
- `lib/site-url.ts` — canonical base URL helper for sitemap/metadata.

### Existing files to modify
- `lib/supabase/env.ts` — add server-only service-role environment getter.
- `lib/events.ts` — add Academy event names.
- `app/dashboard/page.tsx` — load/select Academy content without making it a core guidance dependency; 7-card feed.
- `components/dashboard/dashboard-client.tsx` — same pure selector with demo fixture; 7-card feed.
- `app/layout.tsx` — add `metadataBase` from the site URL helper.
- `app/page.tsx` — add a public Academy entry point.
- `.env.example` — add optional public canonical-site override `NEXT_PUBLIC_SITE_URL`.
- `supabase/tests/rls.sql` — verify public/read-only article policy and owner-only progress read/no client writes.
- `README.md` — document Academy migrations, public routes and runtime boundary.
- `tests/e2e/smoke.spec.ts` — public Academy, selection, under-18/Safe Mode and 7-card regression coverage.

### New tests
- `tests/unit/academy-types.test.ts`
- `tests/unit/academy-migration.test.ts`
- `tests/unit/academy-launch-content.test.ts`
- `tests/unit/academy-repository.test.ts`
- `tests/unit/academy-markdown.test.tsx`
- `tests/unit/academy-selector.test.ts`
- `tests/unit/academy-components.test.tsx`
- `tests/unit/academy-progress-route.test.ts`
- `tests/unit/academy-sitemap.test.ts`

---

### Task 1: Add Academy contracts, schema, RLS and atomic publication

**Files:**
- Create: `lib/academy/types.ts`
- Create: `supabase/migrations/007_academy.sql`
- Modify: `supabase/tests/rls.sql`
- Test: `tests/unit/academy-types.test.ts`
- Test: `tests/unit/academy-migration.test.ts`

**Interfaces:**
- Produces: `AcademyArticle`, `AcademyProgress`, `AcademySelection`, `AcademySelectionContext`, `AcademyAudience`, `AcademySafetyTag`, `AcademySensitivity`, `AcademySourceContext`, `AcademyProgressAction`.
- Produces DB tables: `academy_articles`, `academy_progress` and RPC `publish_academy_article(uuid)`.
- Consumed by: Tasks 2–8.

- [ ] **Step 1: Write the failing Academy type contract test**

Create `tests/unit/academy-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AcademyArticle, AcademySelectionContext } from "@/lib/academy/types";

function acceptsArticle(value: AcademyArticle) { return value; }
function acceptsContext(value: AcademySelectionContext) { return value; }

describe("Academy contracts", () => {
  it("uses controlled article and selector fields", () => {
    const article = acceptsArticle({
      id: "00000000-0000-0000-0000-000000000001",
      contentKey: "credit-file-basics",
      slug: "what-is-a-credit-file",
      version: 1,
      status: "published",
      supersedesId: null,
      title: "What is a credit file?",
      summary20s: "A credit file is a record of credit-related information used as one input by lenders.",
      bodyMarkdown: "## The short version\nYour credit file is not a lender decision.",
      readingMinutes: 2,
      topicTags: ["credit-file"],
      audiences: ["general"],
      missionKeys: [],
      barrierTypes: [],
      passportPillars: [],
      readinessStates: [],
      safetyTags: ["general"],
      sensitivity: "standard",
      sourceName: "MoneyHelper",
      sourceUrl: "https://www.moneyhelper.org.uk/",
      reviewer: "Credit Quest Editorial",
      reviewedAt: "2026-08-28T00:00:00.000Z",
      reviewDueAt: null,
      publishedAt: "2026-08-28T00:00:00.000Z",
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    });
    expect(article.safetyTags).toEqual(["general"]);

    const context = acceptsContext({
      ageMode: "adult",
      safety: { mode: "normal", reasons: [], suppressOffers: false },
      missionKey: null,
      diagnosis: { primary: null, secondary: [], confidence: "low", factors: [] },
      passport: { pillars: [] },
      readiness: { state: "unknown", headline: "Unknown", reasons: [], avoid: [], actions: [], reassessAt: null, daysUntilReassessment: null },
      seenContentKeys: [],
    });
    expect(context.missionKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run the type test and observe RED**

Run:

```bash
npm test -- tests/unit/academy-types.test.ts
```

Expected: FAIL because `@/lib/academy/types` does not exist.

- [ ] **Step 3: Create the serialisable contracts**

Create `lib/academy/types.ts` with these exact controlled values and shapes:

```ts
import type { SafetyAssessment } from "@/lib/domain/safety";
import type {
  AgeMode,
  ApplicationReadiness,
  BarrierDiagnosis,
  BarrierType,
  CreditPassport,
  PassportPillar,
  ReadinessState,
} from "@/lib/domain/types";

export type AcademyStatus = "draft" | "reviewed" | "published" | "superseded" | "archived";
export type AcademyAudience = "general" | "adult" | "under18";
export type AcademySafetyTag = "general" | "under18_safe" | "safe_mode_safe" | "application_oriented" | "borrowing_oriented";
export type AcademySensitivity = "standard" | "sensitive" | "regulated_adjacent";
export type AcademySourceContext = "quest_feed" | "learn_home" | "article" | "related_article" | "mission";
export type AcademyProgressAction = "shown" | "opened" | "completed" | "still_confused";
export type AcademyMatchReason = "mission" | "barrier" | "passport" | "readiness" | "fallback";

export interface AcademyArticle {
  id: string;
  contentKey: string;
  slug: string;
  version: number;
  status: AcademyStatus;
  supersedesId: string | null;
  title: string;
  summary20s: string;
  bodyMarkdown: string;
  readingMinutes: number;
  topicTags: string[];
  audiences: AcademyAudience[];
  missionKeys: string[];
  barrierTypes: BarrierType[];
  passportPillars: PassportPillar["id"][];
  readinessStates: ReadinessState[];
  safetyTags: AcademySafetyTag[];
  sensitivity: AcademySensitivity;
  sourceName: string;
  sourceUrl: string | null;
  reviewer: string;
  reviewedAt: string;
  reviewDueAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyProgress {
  userId: string;
  contentKey: string;
  lastArticleId: string;
  firstShownAt: string | null;
  lastShownAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  stillConfusedAt: string | null;
  lastSourceContext: AcademySourceContext | null;
  updatedAt: string;
}

export interface AcademySelectionContext {
  ageMode: AgeMode;
  safety: SafetyAssessment;
  missionKey: string | null;
  diagnosis: BarrierDiagnosis;
  passport: CreditPassport;
  readiness: ApplicationReadiness;
  seenContentKeys: string[];
}

export interface AcademySelection {
  article: AcademyArticle;
  reasonType: AcademyMatchReason;
  reasonKey: string | null;
  whyThisMatters: string;
}
```

- [ ] **Step 4: Write the failing migration contract test**

Create `tests/unit/academy-migration.test.ts` that reads `supabase/migrations/007_academy.sql` and asserts the two tables, partial unique published indexes, controlled-array checks, RLS policies, denied client writes and `publish_academy_article` function exist:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const path = resolve(process.cwd(), "supabase/migrations/007_academy.sql");

describe("Academy migration", () => {
  it("creates versioned public content and private progress safely", () => {
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const sql = readFileSync(path, "utf8");
    expect(sql).toContain("create table public.academy_articles");
    expect(sql).toContain("create table public.academy_progress");
    expect(sql).toContain("where status = 'published'");
    expect(sql).toContain("academy_articles_public_published_select");
    expect(sql).toContain("academy_progress_select_own");
    expect(sql).toContain("create or replace function public.publish_academy_article");
    expect(sql).toContain("grant execute on function public.publish_academy_article(uuid) to service_role");
    expect(sql).not.toMatch(/grant (insert|update|delete).*academy_articles.*authenticated/i);
    expect(sql).not.toMatch(/grant (insert|update|delete).*academy_progress.*authenticated/i);
  });
});
```

- [ ] **Step 5: Run the migration test and observe RED**

Run:

```bash
npm test -- tests/unit/academy-migration.test.ts
```

Expected: FAIL because migration `007_academy.sql` does not exist.

- [ ] **Step 6: Implement additive migration `007_academy.sql`**

The migration must:

```sql
create table public.academy_articles (
  id uuid primary key default gen_random_uuid(),
  content_key text not null,
  slug text not null,
  version integer not null check (version >= 1),
  status text not null check (status in ('draft','reviewed','published','superseded','archived')),
  supersedes_id uuid references public.academy_articles(id),
  title text not null,
  summary_20s text not null,
  body_markdown text not null,
  reading_minutes integer not null check (reading_minutes >= 1),
  topic_tags text[] not null default '{}',
  audiences text[] not null default '{}',
  mission_keys text[] not null default '{}',
  barrier_types text[] not null default '{}',
  passport_pillars text[] not null default '{}',
  readiness_states text[] not null default '{}',
  safety_tags text[] not null default '{}',
  sensitivity text not null check (sensitivity in ('standard','sensitive','regulated_adjacent')),
  source_name text not null,
  source_url text,
  reviewer text not null,
  reviewed_at timestamptz not null,
  review_due_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_key, version),
  check (audiences <@ array['general','adult','under18']::text[]),
  check (barrier_types <@ array['credit_invisible','thin_file','new_to_uk','credit_rebuilder','affordability_constrained','optimiser']::text[]),
  check (passport_pillars <@ array['identity','payment_health','debt_headroom','affordability_stability','application_readiness']::text[]),
  check (readiness_states <@ array['red','amber','green','unknown']::text[]),
  check (safety_tags <@ array['general','under18_safe','safe_mode_safe','application_oriented','borrowing_oriented']::text[])
);

create unique index academy_articles_one_published_content_key
  on public.academy_articles(content_key) where status = 'published';
create unique index academy_articles_one_published_slug
  on public.academy_articles(slug) where status = 'published';

create table public.academy_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_key text not null,
  last_article_id uuid not null references public.academy_articles(id),
  first_shown_at timestamptz,
  last_shown_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  still_confused_at timestamptz,
  last_source_context text check (last_source_context is null or last_source_context in ('quest_feed','learn_home','article','related_article','mission')),
  updated_at timestamptz not null default now(),
  primary key (user_id, content_key)
);
```

Enable RLS. Grant `SELECT` on `academy_articles` to `anon, authenticated` with a policy `using (status = 'published')`. Grant only own-row `SELECT` on `academy_progress` to `authenticated`. Revoke article/progress `INSERT/UPDATE/DELETE` from `anon, authenticated`.

Implement `publish_academy_article(p_article_id uuid)` as `security definer set search_path = public`. It must lock the target row, require `status = 'reviewed'`, supersede the currently published row for the same `content_key`, then publish the target in one transaction. Revoke execute from `public, anon, authenticated`; grant execute only to `service_role`.

- [ ] **Step 7: Extend `supabase/tests/rls.sql`**

Add catalogue checks asserting:

```sql
-- policy exists and exposes only published Academy rows
-- authenticated users have own-row SELECT on academy_progress
-- no Academy client write policy exists
-- publish_academy_article is not executable by anon/authenticated
```

Use the same `pg_policies`, `information_schema.role_table_grants`, and `information_schema.routine_privileges` style already used by the file; raise an exception if any boundary is missing.

- [ ] **Step 8: Run Task 1 tests GREEN**

Run:

```bash
npm test -- tests/unit/academy-types.test.ts tests/unit/academy-migration.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/academy/types.ts supabase/migrations/007_academy.sql supabase/tests/rls.sql tests/unit/academy-types.test.ts tests/unit/academy-migration.test.ts
git commit -m "feat: add Academy contracts and schema"
```

---

### Task 2: Seed reviewed launch curriculum and protective demo fixtures

**Files:**
- Create: `supabase/migrations/008_academy_launch_content.sql`
- Create: `lib/academy/demo-content.ts`
- Test: `tests/unit/academy-launch-content.test.ts`

**Interfaces:**
- Produces: at least 25 published production rows and `DEMO_ACADEMY_ARTICLES` for no-Supabase demo/E2E mode.
- Protective fallback content keys are exact and stable: `credit-file-basics`, `credit-basics-under-18`, `protect-payments-first`.
- Consumed by: Tasks 3–8.

- [ ] **Step 1: Write the failing launch-content test**

Create `tests/unit/academy-launch-content.test.ts` that reads migration `008` and imports `DEMO_ACADEMY_ARTICLES`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/008_academy_launch_content.sql"), "utf8");

describe("Academy launch curriculum", () => {
  it("ships at least 25 reviewed published articles and all protective fallbacks", () => {
    const contentKeys = [...sql.matchAll(/'([a-z0-9-]+)'\s*,\s*'[^']+'\s*,\s*1\s*,\s*'published'/g)].map((m) => m[1]);
    expect(new Set(contentKeys).size).toBeGreaterThanOrEqual(25);
    expect(sql).toContain("'credit-file-basics'");
    expect(sql).toContain("'credit-basics-under-18'");
    expect(sql).toContain("'protect-payments-first'");
    expect(sql).toContain("'under18_safe'");
    expect(sql).toContain("'safe_mode_safe'");
    expect(DEMO_ACADEMY_ARTICLES.some((a) => a.contentKey === "credit-basics-under-18")).toBe(true);
    expect(DEMO_ACADEMY_ARTICLES.some((a) => a.contentKey === "protect-payments-first")).toBe(true);
  });
});
```

- [ ] **Step 2: Run and observe RED**

```bash
npm test -- tests/unit/academy-launch-content.test.ts
```

Expected: FAIL because the seed migration/demo fixture do not exist.

- [ ] **Step 3: Author the canonical launch curriculum**

Create at least these 29 substantive content keys in `008_academy_launch_content.sql`:

| content_key | Title | Main mapping / safety | Authoritative basis |
|---|---|---|---|
| `credit-file-basics` | What is a credit file? | adult/general fallback | MoneyHelper / ICO |
| `uk-credit-reference-agencies` | The UK credit reference agencies | general | ICO |
| `credit-scores-vs-lender-decisions` | A credit score is not a lender decision | general | MoneyHelper / CRA public guidance |
| `beyond-the-score` | What lenders may look at beyond a score | general | MoneyHelper / FCA consumer guidance |
| `utilisation-basics` | What credit utilisation means | `reduce-utilisation`, debt_headroom | MoneyHelper |
| `lower-utilisation-headroom` | Why available headroom matters | debt_headroom | MoneyHelper |
| `hard-vs-soft-searches` | Hard searches vs soft searches | application_readiness; application-oriented | MoneyHelper |
| `application-spacing` | Why spacing applications can help | `application-cooldown`; application-oriented | MoneyHelper |
| `direct-debits-payment-safeguards` | Use payment safeguards to avoid mistakes | `set-up-direct-debit`; `safe_mode_safe` | MoneyHelper |
| `missed-payment-prevention` | How to reduce the chance of a missed payment | payment_health; `safe_mode_safe` | MoneyHelper |
| `electoral-roll-basics` | Why the electoral roll can matter | `register-electoral-roll`, identity | GOV.UK + MoneyHelper |
| `credit-history-length` | Why credit history takes time | thin-file | MoneyHelper |
| `thin-file-basics` | What a thin credit file means | thin_file | MoneyHelper |
| `new-to-uk-credit-context` | Building UK credit context carefully | new_to_uk | MoneyHelper; conservative wording only |
| `decline-recovery` | What to do after a credit decline | red/amber readiness; application-oriented | MoneyHelper |
| `waiting-can-be-right` | Why waiting can be the right move | red/amber readiness; safe/protective | Credit Quest rules + MoneyHelper |
| `affordability-basics` | Affordability is more than a credit score | affordability_stability | FCA / MoneyHelper |
| `correct-credit-file-errors` | How to challenge incorrect credit-file data | general | ICO / CRA dispute guidance |
| `fraud-identity-protection` | Protect your identity and credit file | general + `safe_mode_safe` | NCSC / Action Fraud |
| `mortgage-preparation` | Credit basics before a mortgage application | adult; application-oriented | MoneyHelper |
| `car-finance-preparation` | Credit basics before car finance | adult; application-oriented | MoneyHelper |
| `revolving-credit-basics` | What revolving credit is | adult; borrowing-oriented | MoneyHelper |
| `credit-limits-headroom` | Credit limits and available headroom | debt_headroom | MoneyHelper |
| `eligibility-soft-searches` | Why soft eligibility checks can be useful | green/amber readiness; application-oriented | MoneyHelper |
| `credit-quest-readiness` | What Credit Quest Application Readiness means | application_readiness | Credit Quest product rules |
| `credit-passport-explained` | What your Credit Passport shows | all Passport pillars | Credit Quest product rules |
| `quest-score-explained` | What the Quest Score does — and does not — mean | general | Credit Quest product rules |
| `credit-basics-under-18` | Credit basics before 18 | `under18_safe` fallback only | Credit Quest education rules + MoneyHelper |
| `protect-payments-first` | Protect payments first | `safe_mode_safe` fallback | Credit Quest Safe Mode rules + MoneyHelper |

For each row, write a plain-English `summary_20s`, a substantive restricted-Markdown body, reading time, mappings, sensitivity, `source_name`, `source_url` where a stable authoritative page is known, `reviewer = 'Credit Quest Editorial'`, a real `reviewed_at`, and a sensible `review_due_at` for regulated-adjacent/time-sensitive content. Do not state lender-specific approval thresholds or imply a universal lender rule.

Use stable known sources where applicable, including:

```text
https://www.gov.uk/register-to-vote
https://ico.org.uk/for-the-public/credit/
https://www.fca.org.uk/consumers/credit-loans-debt
https://www.moneyhelper.org.uk/
https://www.ncsc.gov.uk/
https://www.actionfraud.police.uk/
```

- [ ] **Step 4: Add a small reviewed demo fixture**

Create `lib/academy/demo-content.ts` containing at least these five `AcademyArticle` values and exact slugs:

```text
credit-file-basics -> what-is-a-credit-file
credit-basics-under-18 -> credit-basics-before-18
protect-payments-first -> protect-payments-first
electoral-roll-basics -> electoral-roll-basics
application-spacing -> application-spacing
```

The fixture is explicitly demo/test-only and is used only when `getSupabasePublicEnv()` returns `null`. It must use the same provenance/safety fields as production rows and must not be used as a production fallback when configured Supabase reads fail.

- [ ] **Step 5: Run content tests GREEN and full unit regression**

```bash
npm test -- tests/unit/academy-launch-content.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/008_academy_launch_content.sql lib/academy/demo-content.ts tests/unit/academy-launch-content.test.ts
git commit -m "feat: seed Academy launch curriculum"
```

---

### Task 3: Add safe Academy repository and restricted Markdown renderer

**Files:**
- Create: `lib/server/academy-repository.ts`
- Create: `lib/academy/markdown.tsx`
- Test: `tests/unit/academy-repository.test.ts`
- Test: `tests/unit/academy-markdown.test.tsx`

**Interfaces:**
- Produces: `mapAcademyArticleRow`, `mapAcademyProgressRow`, `listPublishedAcademyArticles`, `getPublishedAcademyArticleBySlug`, `getPublishedAcademyArticleById`, `listAcademyProgress`, `relatedAcademyArticles`, `publishAcademyArticle`.
- Produces component: `AcademyMarkdown({ markdown })`.
- Consumed by: Tasks 4–8.

- [ ] **Step 1: Write failing repository tests**

Use the existing Supabase-client stub pattern from repository tests. Cover row mapping and public query semantics:

```ts
expect(mapAcademyArticleRow(row)).toMatchObject({
  contentKey: "credit-file-basics",
  summary20s: "Short summary",
  safetyTags: ["general"],
});
```

Also assert:

```text
listPublishedAcademyArticles -> .eq("status", "published")
getPublishedAcademyArticleBySlug -> slug + published filters
getPublishedAcademyArticleById -> id + published filters
publishAcademyArticle -> .rpc("publish_academy_article", { p_article_id: articleId })
```

- [ ] **Step 2: Run repository test RED**

```bash
npm test -- tests/unit/academy-repository.test.ts
```

Expected: missing module/functions.

- [ ] **Step 3: Implement repository functions**

Use a focused select list rather than `select("*")`:

```ts
const ACADEMY_SELECT = "id,content_key,slug,version,status,supersedes_id,title,summary_20s,body_markdown,reading_minutes,topic_tags,audiences,mission_keys,barrier_types,passport_pillars,readiness_states,safety_tags,sensitivity,source_name,source_url,reviewer,reviewed_at,review_due_at,published_at,created_at,updated_at";
```

Export:

```ts
export function mapAcademyArticleRow(row: Record<string, unknown>): AcademyArticle;
export function mapAcademyProgressRow(row: Record<string, unknown>): AcademyProgress;
export async function listPublishedAcademyArticles(supabase: SupabaseClient): Promise<AcademyArticle[]>;
export async function getPublishedAcademyArticleBySlug(supabase: SupabaseClient, slug: string): Promise<AcademyArticle | null>;
export async function getPublishedAcademyArticleById(supabase: SupabaseClient, articleId: string): Promise<AcademyArticle | null>;
export async function listAcademyProgress(supabase: SupabaseClient, userId: string): Promise<AcademyProgress[]>;
export function relatedAcademyArticles(article: AcademyArticle, all: AcademyArticle[], limit = 3): AcademyArticle[];
export async function publishAcademyArticle(admin: SupabaseClient, articleId: string): Promise<void>;
```

`relatedAcademyArticles` ranks by count of shared `topicTags`, excludes the same `contentKey`, then stable-sorts by `contentKey`. `publishAcademyArticle` only wraps the server-only RPC; it does not expose a browser route in this slice.

- [ ] **Step 4: Write failing Markdown safety tests**

Create `tests/unit/academy-markdown.test.tsx` with Testing Library. Required assertions:

```ts
render(<AcademyMarkdown markdown={'## Safe heading\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert(1))\n\n[Good](https://www.gov.uk/register-to-vote)'} />);
expect(screen.getByRole("heading", { name: "Safe heading" })).toBeVisible();
expect(document.querySelector("script")).toBeNull();
expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
expect(screen.getByRole("link", { name: "Good" })).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
```

- [ ] **Step 5: Run Markdown test RED**

```bash
npm test -- tests/unit/academy-markdown.test.tsx
```

- [ ] **Step 6: Implement the restricted renderer without a new package**

Support only:

```text
## heading
### heading
plain paragraphs
- unordered list item
1. ordered list item
[link text](https://...)
**bold**
*emphasis*
```

React text rendering provides escaping. Treat raw HTML-looking text as non-executable text; never use `dangerouslySetInnerHTML`. Only create anchors for `https://` URLs. External anchors use `target="_blank" rel="noreferrer"`. Unsupported Markdown remains readable plain text.

Keep the parser deliberately small: split input into blocks, parse heading/list prefixes, and apply a conservative inline-token parser for HTTPS links/bold/emphasis.

- [ ] **Step 7: Run Task 3 tests GREEN**

```bash
npm test -- tests/unit/academy-repository.test.ts tests/unit/academy-markdown.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add lib/server/academy-repository.ts lib/academy/markdown.tsx tests/unit/academy-repository.test.ts tests/unit/academy-markdown.test.tsx
git commit -m "feat: add Academy repository and safe renderer"
```

---

### Task 4: Build public Academy library, article routes and SEO

**Files:**
- Create: `components/academy/academy-library.tsx`
- Create: `components/academy/academy-article.tsx`
- Create: `app/learn/page.tsx`
- Create: `app/learn/[slug]/page.tsx`
- Create: `app/sitemap.ts`
- Create: `lib/site-url.ts`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `.env.example`
- Test: `tests/unit/academy-components.test.tsx`
- Test: `tests/unit/academy-sitemap.test.ts`

**Interfaces:**
- `AcademyLibrary({ articles, query, topic })` and `AcademyUnavailable()` are exported from `components/academy/academy-library.tsx`.
- `AcademyArticleView({ article, related })` is exported from `components/academy/academy-article.tsx`.
- Public routes consume published `AcademyArticle[]` from Task 3 or `DEMO_ACADEMY_ARTICLES` only when Supabase is unconfigured.
- Production/configured Supabase read failure renders `AcademyUnavailable`; it does not fall back to demo content.

- [ ] **Step 1: Write failing presentation tests**

Assert:

```ts
render(<AcademyLibrary articles={[article]} query="" topic={null} />);
expect(screen.getByRole("heading", { name: /Credit Quest Academy/i })).toBeVisible();
expect(screen.getByRole("link", { name: article.title })).toHaveAttribute("href", `/learn/${article.slug}`);

render(<AcademyArticleView article={article} related={[]} />);
expect(screen.getByText(article.summary20s)).toBeVisible();
expect(screen.getByText(/Last reviewed/i)).toBeVisible();
expect(screen.queryByText(/Sponsored/i)).toBeNull();
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/unit/academy-components.test.tsx
```

- [ ] **Step 3: Implement public components**

`AcademyLibrary` receives already-published rows and deterministically filters by lower-cased title, summary and `topicTags`. The route reads `searchParams.q` and `searchParams.topic`; no separate search service is needed at launch.

`AcademyUnavailable` renders a clear temporary-unavailable message and a link back to the main Credit Quest journey; it contains no substitute financial lesson.

`AcademyArticleView` renders title, `summary20s` first, reading time, reviewed date, source/reviewer, `AcademyMarkdown`, related article links and an explicit educational disclaimer. No sponsored slot is accepted as a prop.

- [ ] **Step 4: Implement public routes**

`app/learn/page.tsx`:

```ts
if (!getSupabasePublicEnv()) {
  return <AcademyLibrary articles={DEMO_ACADEMY_ARTICLES} query={q} topic={topic} />;
}
try {
  const supabase = await createServerSupabaseClient();
  const articles = await listPublishedAcademyArticles(supabase);
  return <AcademyLibrary articles={articles} query={q} topic={topic} />;
} catch {
  return <AcademyUnavailable />;
}
```

`app/learn/[slug]/page.tsx` uses the same environment rule. For configured Supabase, unknown/unpublished slug calls `notFound()`. `generateMetadata` uses the published article title/summary and a canonical `/learn/{slug}` path; do not generate metadata from unreviewed data.

- [ ] **Step 5: Add canonical URL helper, env override and sitemap**

Create `lib/site-url.ts`:

```ts
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
```

Add this exact line to `.env.example`:

```text
NEXT_PUBLIC_SITE_URL=
```

Set `metadataBase: getSiteUrl()` in `app/layout.tsx`.

`app/sitemap.ts` returns `/`, `/learn`, and only published article URLs. In no-Supabase demo/test mode it may use `DEMO_ACADEMY_ARTICLES`; configured read failure returns core static URLs only rather than exposing unpublished data.

- [ ] **Step 6: Write and run sitemap test**

Mock repository results containing one published article and assert sitemap includes it and never includes a supplied draft/superseded fixture. Run:

```bash
npm test -- tests/unit/academy-sitemap.test.ts
```

- [ ] **Step 7: Add home-page Academy entry point**

Add a secondary public link `Learn about credit` -> `/learn` without changing the primary onboarding CTA.

- [ ] **Step 8: Run Task 4 GREEN and build**

```bash
npm test -- tests/unit/academy-components.test.tsx tests/unit/academy-sitemap.test.ts
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add components/academy app/learn app/sitemap.ts lib/site-url.ts app/layout.tsx app/page.tsx .env.example tests/unit/academy-components.test.tsx tests/unit/academy-sitemap.test.ts
git commit -m "feat: add public Credit Quest Academy"
```

---

### Task 5: Implement deterministic protective Academy selection

**Files:**
- Create: `lib/academy/selector.ts`
- Test: `tests/unit/academy-selector.test.ts`

**Interfaces:**
- Consumes: `AcademyArticle[]`, `AcademySelectionContext`.
- Produces: `selectAcademyArticle(articles, context): AcademySelection | null`.
- Commercial fields do not exist in the context type.
- Consumed by: Task 6.

- [ ] **Step 1: Write failing selector tests**

Cover all ordering and protective contracts with small article fixtures. Required cases:

```ts
expect(selectAcademyArticle(articles, under18Context)?.article.contentKey).toBe("credit-basics-under-18");
expect(selectAcademyArticle(articles, safeModeContext)?.article.contentKey).toBe("protect-payments-first");
expect(selectAcademyArticle(articles, { ...adultContext, missionKey: "register-electoral-roll" })?.article.contentKey).toBe("electoral-roll-basics");
```

Also test: primary barrier beats Passport/readiness; red Passport match beats amber; readiness is lower priority; unseen wins only equal relevance; final tie is alphabetical `contentKey`; no eligible match uses the correct protective fallback; a normal adult with red/unknown readiness cannot select an `application_oriented` or `borrowing_oriented` article merely because it also has `general`.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/unit/academy-selector.test.ts
```

- [ ] **Step 3: Implement protective eligibility first**

Use exact rules:

```ts
function isEligibleForContext(article: AcademyArticle, context: AcademySelectionContext): boolean {
  if (context.ageMode === "education") return article.safetyTags.includes("under18_safe");
  if (context.safety.mode === "safe_mode") return article.safetyTags.includes("safe_mode_safe");

  const restricted = article.safetyTags.includes("application_oriented") || article.safetyTags.includes("borrowing_oriented");
  if (restricted && context.readiness.state !== "green") return false;
  return article.safetyTags.includes("general") || restricted;
}
```

This is intentionally conservative; `waiting-can-be-right` and protective education should be tagged safe/general rather than `application_oriented` if they need to surface before green readiness.

- [ ] **Step 4: Implement lexicographic relevance ranking**

Do not sum weights that could let multiple lower-priority matches overtake a mission match. Build a tuple per article:

```ts
[missionMatch, barrierRank, passportRank, readinessMatch, novelty]
```

Where:

```text
missionMatch: 1 exact current mission, else 0
barrierRank: 2 primary, 1 secondary, 0 none
passportRank: 3 red, 2 amber, 1 unknown, 0 none
readinessMatch: 1 matching current readiness state, else 0
novelty: 1 unseen, 0 seen
```

Compare each tuple left-to-right descending, then `contentKey.localeCompare` ascending.

Set reason/copy from the first winning dimension only:

```text
mission   -> "This explains the action Credit Quest has ranked for you right now."
barrier   -> "This explains the main credit-building barrier Credit Quest has identified."
passport  -> "This explains a Credit Passport area that currently needs attention."
readiness -> "This helps explain your current application-readiness guidance."
fallback  -> "A useful foundation for understanding your next steps in Credit Quest."
```

Fallback keys are exact:

```text
education -> credit-basics-under-18
safe_mode -> protect-payments-first
adult     -> credit-file-basics
```

Return `null` only if even the required fallback is absent/unpublished from the supplied eligible article set.

- [ ] **Step 5: Run GREEN and full unit regression**

```bash
npm test -- tests/unit/academy-selector.test.ts
npm test
```

- [ ] **Step 6: Commit**

```bash
git add lib/academy/selector.ts tests/unit/academy-selector.test.ts
git commit -m "feat: add deterministic Academy selector"
```

---

### Task 6: Add the seventh `Learn in 20 seconds` Quest Feed card

**Files:**
- Create: `components/academy/academy-card.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`
- Test: `tests/unit/academy-components.test.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- `AcademyCard({ selection }: { selection: AcademySelection | null })`.
- Production dashboard obtains published articles/progress best-effort, then calls `selectAcademyArticle` with existing upstream guidance outputs.
- Demo dashboard calls the same selector with `DEMO_ACADEMY_ARTICLES` and `seenContentKeys: []` initially.

- [ ] **Step 1: Write RED component/E2E expectations**

Add to `academy-components.test.tsx`:

```ts
render(<AcademyCard selection={selection} />);
expect(screen.getByText("Learn in 20 seconds")).toBeVisible();
expect(screen.getByText(selection.whyThisMatters)).toBeVisible();
expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", `/learn/${selection.article.slug}`);
expect(screen.queryByText(/Sponsored|Commercial/i)).toBeNull();
```

Update adult smoke test from 6 to 7 cards and require `Learn in 20 seconds` between Readiness and Progress. Run Playwright and observe RED because the feed still has 6 cards.

- [ ] **Step 2: Implement `AcademyCard`**

Render only approved selection fields. When `selection` is null, render a neutral unavailable state:

```text
Learning is temporarily unavailable.
Your missions, Passport and readiness guidance are unaffected.
```

Do not inject a hard-coded financial lesson for this failure state.

- [ ] **Step 3: Integrate persisted/server dashboard best-effort**

In `app/dashboard/page.tsx` set `FEED_CARD_TOTAL = 7` and add card order:

```text
1 Your next move
2 Why this matters
3 Your Credit Passport
4 Can I apply yet?
5 Learn in 20 seconds
6 Your progress
7 Know what the score means
```

After existing age/safety/diagnosis/readiness/passport/mission work is complete, load Academy inside its own `try/catch`:

```ts
let academySelection: AcademySelection | null = null;
try {
  const [articles, progressRows] = await Promise.all([
    listPublishedAcademyArticles(supabase),
    listAcademyProgress(supabase, user.id),
  ]);
  academySelection = selectAcademyArticle(articles, {
    ageMode,
    safety,
    missionKey: next?.mission.slug ?? null,
    diagnosis,
    passport,
    readiness,
    seenContentKeys: progressRows.filter((p) => p.lastShownAt).map((p) => p.contentKey),
  });
} catch {
  academySelection = null;
}
```

Do not include offers/provider/action commercial data in this context.

- [ ] **Step 4: Integrate demo dashboard using the same selector**

In `components/dashboard/dashboard-client.tsx`, include `ageMode` in the existing memo result, call `selectAcademyArticle(DEMO_ACADEMY_ARTICLES, context)`, set total to 7, and insert the same card at position 5. Do not create a separate demo ranking algorithm.

- [ ] **Step 5: Run Task 6 GREEN**

```bash
npm test -- tests/unit/academy-components.test.tsx
npm run test:e2e
```

Expected existing regression cases continue to pass with 7 cards.

- [ ] **Step 6: Commit**

```bash
git add components/academy/academy-card.tsx app/dashboard/page.tsx components/dashboard/dashboard-client.tsx tests/unit/academy-components.test.tsx tests/e2e/smoke.spec.ts
git commit -m "feat: add Academy Quest Feed card"
```

---

### Task 7: Add authenticated progress, feedback and Academy event taxonomy

**Files:**
- Create: `lib/supabase/admin.ts`
- Modify: `lib/supabase/env.ts`
- Modify: `lib/server/academy-repository.ts`
- Modify: `lib/events.ts`
- Create: `components/academy/academy-tracker.tsx`
- Create: `app/api/academy/progress/route.ts`
- Modify: `components/academy/academy-card.tsx`
- Modify: `components/academy/academy-library.tsx`
- Modify: `components/academy/academy-article.tsx`
- Test: `tests/unit/events.test.ts`
- Test: `tests/unit/academy-progress-route.test.ts`

**Interfaces:**
- API body: `{ action: AcademyProgressAction; contentKey: string; articleId: string; sourceContext: AcademySourceContext }`.
- API authenticates using cookie-bound server client, validates exact published article identity, then writes with a service-role client whose credential never reaches the browser.
- Analytics remain best-effort and never block article readability/core guidance.

- [ ] **Step 1: Extend event test RED**

Add valid event cases:

```text
academy_card_shown
academy_article_opened
academy_article_completed
academy_still_confused
academy_search_used
academy_related_mission_started
```

Run `npm test -- tests/unit/events.test.ts`; expect RED until `eventNames` is extended.

- [ ] **Step 2: Add service-role environment/client safely**

In `lib/supabase/env.ts` add:

```ts
export function getSupabaseServiceEnv() {
  const publicEnv = getSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv || !serviceRoleKey) return null;
  return { ...publicEnv, serviceRoleKey };
}
```

Create `lib/supabase/admin.ts` using `createClient` from `@supabase/supabase-js` with the service role key, `persistSession: false`, `autoRefreshToken: false`. This file is imported only by server route/repository modules.

- [ ] **Step 3: Write failing progress-route tests**

Use module mocks following existing route-test patterns. Cover:

```text
400 invalid body
401 unauthenticated user
404 article id missing/unpublished
404 article id exists but contentKey does not match
204 successful progress write
500 progress write failure
```

Also assert the client cannot supply `userId`; schema is strict and server always uses `auth.getUser().id`.

- [ ] **Step 4: Implement progress payload validation and repository write**

Use Zod strict schema in the API module or a focused `lib/academy/progress-schema.ts` if the route becomes large:

```ts
z.object({
  action: z.enum(["shown","opened","completed","still_confused"]),
  contentKey: z.string().min(1).max(100),
  articleId: z.string().uuid(),
  sourceContext: z.enum(["quest_feed","learn_home","article","related_article","mission"]),
}).strict();
```

Add repository function:

```ts
export async function recordAcademyProgress(
  admin: SupabaseClient,
  userId: string,
  article: AcademyArticle,
  action: AcademyProgressAction,
  sourceContext: AcademySourceContext,
  now = new Date(),
): Promise<void>;
```

Read existing row by `(user_id, content_key)`, then upsert while preserving first timestamps and only advancing the field for the requested action. Always update `last_article_id`, `last_source_context`, `updated_at`; `shown` updates `last_shown_at` and sets `first_shown_at` only if absent.

- [ ] **Step 5: Implement API route with exact article validation**

Flow is exact:

```text
parse body
-> if no public/service env: 204 (demo mode, non-critical)
-> authenticate user with cookie-bound createServerSupabaseClient
-> 401 if no user
-> getPublishedAcademyArticleById(normal server client, articleId)
-> 404 if missing/unpublished
-> 404 if article.contentKey !== body.contentKey
-> create admin client
-> recordAcademyProgress(admin, authenticated user id, article, action, sourceContext)
-> 204
```

Never trust a client-provided user ID, status or safety classification.

- [ ] **Step 6: Implement best-effort client tracking**

`components/academy/academy-tracker.tsx` exports:

```ts
AcademyCardTracker({ selection })
AcademyArticleTracker({ article })
AcademySearchTracker({ query })
```

`AcademyCardTracker` sends `academy_card_shown` + progress `shown` once per mounted content key.

`AcademyArticleTracker` sends `academy_article_opened` + progress `opened` on mount, and exposes accessible controls used by `AcademyArticleView` for `academy_article_completed` / `academy_still_confused` plus progress writes.

`AcademySearchTracker` sends `academy_search_used` only when a non-empty `query` is present; include the query string and result count only, never profile/commercial fields. Render it from `AcademyLibrary`.

All calls are best-effort. `AcademyCard` and article content never wait for tracking. On public anonymous article pages, event/progress requests may receive 401 and are ignored; content remains fully readable. `Still confused?` acknowledges locally and may explain that signing in preserves learning feedback. Do not add an unauthenticated database-write endpoint.

- [ ] **Step 7: Run Task 7 GREEN**

```bash
npm test -- tests/unit/events.test.ts tests/unit/academy-progress-route.test.ts tests/unit/academy-components.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/admin.ts lib/supabase/env.ts lib/server/academy-repository.ts lib/events.ts components/academy/academy-tracker.tsx components/academy/academy-card.tsx components/academy/academy-library.tsx components/academy/academy-article.tsx app/api/academy/progress/route.ts tests/unit/events.test.ts tests/unit/academy-progress-route.test.ts tests/unit/academy-components.test.tsx
git commit -m "feat: track Academy learning progress"
```

---

### Task 8: Protective E2E, documentation and release/database hardening

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `README.md`
- Modify: `supabase/tests/rls.sql` if DB verification reveals a missing assertion.

**Interfaces:**
- Final release must prove existing V2.1 strategy/commercial boundaries are unchanged.

- [ ] **Step 1: Expand Playwright public Academy coverage**

Add tests that, in no-Supabase demo mode:

```text
GET /learn is public and shows Credit Quest Academy
GET /learn/what-is-a-credit-file renders without login
unknown slug returns the not-found experience
adult onboarding yields exactly 7 feed cards
an electoral-roll mission selects electoral-roll education
Learn more opens the canonical /learn/[slug] page
```

- [ ] **Step 2: Expand protective browser cases**

Existing under-18 test must also assert the Academy card is `Credit basics before 18` and still has no product eligibility CTA.

Existing Safe Mode test must also assert the Academy card is `Protect payments first` and still has no product/referral CTA.

Existing amber/no-countdown, Passport, Readiness, mission-start and offer-separation tests must remain unchanged apart from the feed-card count/index additions.

- [ ] **Step 3: Add architecture contamination assertions**

In `academy-selector.test.ts` or a focused source-boundary test, read `lib/academy/selector.ts` and assert it does not import or contain these terms:

```text
offer-matcher
affiliate
commission
provider payout
campaign
EPC
```

Also assert `lib/domain/safety.ts`, `diagnosis.ts`, `passport.ts`, `readiness.ts` do not import `lib/academy`.

- [ ] **Step 4: Update README**

Document:

```text
V2.1 Academy public /learn routes
007 Academy schema migration
008 launch-content migration
Academy is downstream of strategy and commercially isolated
Supabase is canonical in configured environments; small reviewed fixture is demo/test-only
service-role key remains server-side
content can be versioned/published independently of an app deployment
```

Update migration list through `008`.

- [ ] **Step 5: Run exact full application release gate**

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: all green on the exact branch head.

- [ ] **Step 6: Run local Supabase database verification before production DDL**

With the local Supabase stack running:

```bash
npx supabase start
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls.sql
```

If a non-default local DB port is configured, take the database URL from `npx supabase status`; do not invent or reuse production credentials.

Verify with SQL:

```text
29 launch rows are present and published
exactly one published row per content_key and slug
anon can SELECT published articles but not draft/reviewed rows
anon/authenticated cannot author Academy rows
user A cannot SELECT user B progress
authenticated role cannot INSERT/UPDATE/DELETE progress directly
service_role can call publish_academy_article
publishing a reviewed v2 supersedes v1 atomically
```

- [ ] **Step 7: Run Supabase advisor/security checks after applying 007/008 in the target project**

Use the existing Supabase project tooling to check schema/security/performance advisors. Do not treat SQL text tests as a substitute for live RLS verification.

- [ ] **Step 8: Open a draft PR and verify exact-head CI/Vercel preview**

PR title:

```text
V2.1 Credit Quest Academy
```

PR body must state: 7-card finite feed, public `/learn`, 25+ reviewed content entries, protective selection, content/progress RLS, no commercial selector inputs, no CRA/Open Banking/lender API added, exact CI head and migration versions.

Keep the PR draft until full CI, database verification and a Vercel preview are green. Do not merge without explicit user approval.

- [ ] **Step 9: Commit final hardening/docs**

```bash
git add tests README.md supabase/tests/rls.sql
git commit -m "test: harden Academy release boundaries"
```

---

## Plan self-review checklist

Before execution starts, verify:

1. Every design-spec section maps to a task: canonical Supabase content (Tasks 1–3), public Academy/SEO (Task 4), deterministic selector (Task 5), seven-card feed (Task 6), progress/events (Task 7), protective/release verification (Task 8).
2. No Academy task adds a dependency from core safety/diagnosis/passport/readiness/mission ranking back to Academy.
3. No commercial input appears in `AcademySelectionContext`.
4. Demo content is used only for unconfigured demo/test mode, never as a configured-production data-source failure fallback.
5. Launch content includes normal, under-18 and Safe Mode fallback keys.
6. Service-role credentials remain server-only and direct client Academy writes remain denied.
7. Progress writes validate the exact published `articleId` and matching `contentKey` before service-role upsert.
8. `AcademyUnavailable`, exact article-by-ID lookup, publish RPC wrapper and search tracking all have explicit owning files/interfaces.
9. No new Markdown/runtime dependency is required.
10. Final merge remains a separate explicit user approval after exact-head verification.
