# Credit Quest V2.1 — Academy Design

**Date:** 2026-08-28  
**Status:** Approved design, awaiting written-spec review  
**Branch:** `feat/v2-1-academy`  
**Related roadmap:** #8 Credit Quest Wiki / Academy, #10 V2.1 speed-to-market platform, #7 customer journey + monetisation boundary

## 1. Purpose

Credit Quest Academy adds a trustworthy learning layer to the product without turning education into advertising or allowing educational content to influence credit strategy.

The Academy must serve two surfaces from one canonical content source:

1. A public, indexable learning area for discoverability and SEO.
2. A personalised in-Quest learning card selected from the user's existing mission, barrier, Credit Passport and Application Readiness state.

The core proposition is:

> Explain the next useful credit concept in plain English, in about 20 seconds, then offer deeper detail only when the user wants it.

The Academy is downstream of Credit Quest's deterministic strategy engines. It may explain a decision, but it must never create, override or commercialise that decision.

## 2. Product outcomes

The first Academy release should let a user:

- browse a public `/learn` library without signing in;
- open an SEO-friendly `/learn/[slug]` article;
- see one relevant `Learn in 20 seconds` card inside the finite Quest Feed;
- understand why that topic matters to their current situation;
- open the deeper article when useful;
- move naturally from learning into an already-valid mission where a relationship exists;
- signal that they are still confused without being pushed into more screen time.

The business should be able to:

- launch with at least 25 useful, reviewed Academy entries;
- update Academy content independently of application deployments;
- maintain reviewer/source/review-date/version provenance;
- see useful learning outcomes rather than engagement-for-engagement's-sake;
- later add a lightweight authoring surface without redesigning the content model.

## 3. Non-negotiable boundaries

### 3.1 Decisioning separation

Academy code must not change:

- safety assessment;
- age mode;
- barrier diagnosis;
- Application Readiness;
- Credit Passport statuses;
- mission ranking;
- offer matching or offer suppression.

The allowed dependency direction is:

```text
profile/accounts
  -> age + safety + diagnosis + passport + readiness + mission ranking
  -> Academy selector
  -> educational content presentation
```

The reverse dependency is prohibited. Academy viewing, completion, content metadata or commercial performance must never write back into the core strategy engines.

### 3.2 Commercial separation

Academy ranking must have no access to:

- affiliate commission;
- CPA/CPL payout;
- EPC;
- partner priority;
- conversion rate;
- campaign economics;
- sponsored inventory;
- provider commercial preference.

Sponsored or partner content must live outside the Academy content model and render with explicit commercial labelling. It must not enter Academy selection or appear as education.

### 3.3 Safety and age

Under-18 and Safe Mode filtering happens before Academy topic selection, not only at render time.

Under-18 users may receive educational material but must not be encouraged toward regulated credit products or eligibility/application actions.

Safe Mode users should receive protective/stability-focused education. Borrowing-oriented or application-oriented topics must be suppressed when inappropriate.

### 3.4 AI boundary

No AI is required for V2.1 Academy selection or publication.

If AI is introduced later, it may simplify wording or personalise tone from approved source content. It must not invent lending rules, lender criteria, eligibility claims, approval probabilities or unreviewed financial guidance.

## 4. Architecture choice

### 4.1 Selected approach: Supabase-backed canonical Academy

The Academy will use Supabase as its canonical content store.

This is preferred over hard-coded MDX because editorial changes should not require a Vercel deployment, and preferred over an external CMS because a second content platform, authentication model and vendor dependency are unnecessary for the first release.

The application remains responsible for rendering, selection and safety. Supabase stores approved content and user learning progress.

### 4.2 No full admin CMS in this slice

The first release does not include a large editorial/admin application.

Initial launch content will be seeded through controlled database migrations or server-owned seed tooling. Subsequent content versions can be published through controlled database/server tooling without an application deployment. The schema is designed so a later internal editor can support preview, review, publish, rollback and audit history without changing the public or in-Quest content APIs.

## 5. Content model

### 5.1 `academy_articles`

Use one row per article version.

Recommended fields:

```text
id uuid primary key
content_key text not null
slug text not null
version integer not null
status text not null
supersedes_id uuid null

title text not null
summary_20s text not null
body_markdown text not null
reading_minutes integer not null

topic_tags text[] not null default '{}'
audiences text[] not null default '{}'
mission_keys text[] not null default '{}'
barrier_types text[] not null default '{}'
passport_pillars text[] not null default '{}'
readiness_states text[] not null default '{}'
safety_tags text[] not null default '{}'

sensitivity text not null
source_name text not null
source_url text null
reviewer text not null
reviewed_at timestamptz not null
review_due_at timestamptz null

published_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

`content_key` is the stable logical identity of the article across versions. `id` identifies a specific version.

`body_markdown` is a restricted Markdown format. Raw HTML, JavaScript, iframes and arbitrary embedded scripts are not supported. Rendering must use a sanitised/allowlisted Markdown path so Academy content cannot become an executable-content channel.

Allowed publication states:

```text
draft -> reviewed -> published -> superseded
                         \-> archived
```

A draft may also be archived before publication.

Recommended constraints:

- `version >= 1`;
- unique `(content_key, version)`;
- `reading_minutes >= 1`;
- status constrained to `draft`, `reviewed`, `published`, `superseded`, `archived`;
- sensitivity constrained to `standard`, `sensitive`, or `regulated_adjacent`;
- only one currently published row per `content_key`;
- only one currently published row per `slug`.

### 5.2 Mapping vocabulary

Mappings must use controlled values rather than arbitrary prose where they drive selection.

`audiences` allowed values for V2.1:

```text
general
adult
under18
```

`safety_tags` allowed values for V2.1:

```text
general
under18_safe
safe_mode_safe
application_oriented
borrowing_oriented
```

An article may carry more than one safety tag. Empty safety tags mean the content is not eligible for personalised protective selection until explicitly classified.

The selector applies these rules:

- under-18: only articles tagged `under18_safe` are eligible;
- Safe Mode: only articles tagged `safe_mode_safe` are eligible;
- normal adult mode: `general` content is eligible, while `application_oriented` or `borrowing_oriented` content remains subject to the user's existing readiness/safety context;
- an article tagged `application_oriented` or `borrowing_oriented` is never made eligible merely because it is also generally relevant.

`mission_keys`, `barrier_types`, `passport_pillars`, and `readiness_states` must be validated against the existing Credit Quest domain identifiers rather than accepting invented labels.

`topic_tags` are editorial discovery/search categories only. They may help public browsing and related-article links but do not outrank the deterministic personalisation rules above.

### 5.3 Publication/version rules

Published content is immutable in product workflow.

A material edit creates a new version with the same `content_key` and a `supersedes_id` pointing to the previous version. Publication of the new version happens atomically with moving the old version to `superseded`.

The implementation should expose one server-owned publish operation so the two state changes cannot leave two active published versions or temporarily remove the current article.

This prevents silent historical rewrites and preserves the exact text/source/reviewer state that was live at any point.

Minor non-content operational fields may be corrected only through controlled server tooling with an audit event.

### 5.4 Public read policy

Anonymous and authenticated public reads may access only rows with `status = 'published'`.

Draft, reviewed, superseded and archived content must not be exposed through public application queries.

Create/update/delete/publish permissions remain server/admin-controlled. Browser clients do not receive authoring rights.

## 6. User learning progress

### 6.1 `academy_progress`

Learning progress exists only for authenticated users.

Recommended fields:

```text
user_id uuid not null
content_key text not null
last_article_id uuid not null
first_shown_at timestamptz null
last_shown_at timestamptz null
opened_at timestamptz null
completed_at timestamptz null
still_confused_at timestamptz null
last_source_context text null
updated_at timestamptz not null default now()
primary key (user_id, content_key)
```

Using `content_key` rather than a specific article-version ID for the primary key means a new editorial version does not reset the user's entire seen/completed history. `last_article_id` records which content version was most recently interacted with.

Authenticated users may SELECT only their own progress rows. Direct browser insert/update/delete access is not granted. Progress writes go through server-owned API routes that authenticate the user, force the row `user_id` to the authenticated user, validate allowed transitions/source contexts, and then perform the write.

Academy progress must not be read by readiness, passport, diagnosis, safety or mission-ranking modules.

## 7. Public Academy experience

### 7.1 `/learn`

The public Academy landing page should:

- explain what Credit Quest Academy is;
- expose topic/category browsing from `topic_tags`;
- support a simple text search over published title, summary and topic tags;
- show reading time;
- prioritise clarity over volume;
- link to individual article pages;
- contain no sponsored ranking.

The initial release can use server-side Supabase queries and simple deterministic filtering. Full-text search infrastructure is not required until usage demonstrates a need.

### 7.2 `/learn/[slug]`

Each published article page should include:

- clear title;
- 20-second summary first;
- full article beneath;
- reading time;
- last reviewed date;
- source/reviewer provenance where appropriate;
- related Academy topics;
- relevant Credit Quest action link only when the relationship is deterministic and appropriate;
- a `Still confused?` feedback action;
- explicit separation from any commercial content.

The route returns a real not-found response for unpublished or unknown slugs.

External links from article content must use safe link handling and may not execute supplied script/HTML.

### 7.3 SEO

Published articles should be server-rendered and indexable.

Each article provides:

- unique metadata title and description;
- canonical URL;
- Open Graph metadata using existing application patterns where practical;
- sitemap inclusion;
- sensible internal links between related Academy topics;
- crawlable public body content.

Draft/reviewed/superseded/archived rows must never enter the sitemap.

No SEO text generation via AI is required for this release.

## 8. In-Quest Academy experience

### 8.1 Quest Feed expands from six to seven finite cards

The existing finite feed becomes:

1. Your next move
2. Why this matters
3. Your Credit Passport
4. Can I apply yet?
5. Learn in 20 seconds
6. Your progress
7. Know what the score means

The feed remains finite and non-addictive. No infinite education feed, autoplay, streaks or fake urgency are introduced.

### 8.2 Academy card

The card contains:

- `Learn in 20 seconds` label;
- topic title;
- `summary_20s`;
- one `Why this matters for you` sentence derived from deterministic selection context;
- one `Learn more` link to `/learn/[slug]`.

The card does not contain a sponsored CTA.

## 9. Deterministic topic selection

### 9.1 Inputs

The selector may receive only customer-benefit inputs already produced upstream, for example:

```ts
interface AcademySelectionContext {
  ageMode: AgeMode;
  safety: SafetyAssessment;
  missionKey: string | null;
  diagnosis: BarrierDiagnosis;
  passport: CreditPassport;
  readiness: ApplicationReadiness;
  seenContentKeys: string[];
}
```

Commercial or offer information is not part of this interface.

### 9.2 Ordered selection rules

Selection is deterministic and follows this priority:

1. **Protective eligibility filter**
   - apply the controlled `safety_tags` rules before calculating relevance;
   - apply under-18 restrictions;
   - apply Safe Mode restrictions;
   - exclude any content not allowed for that context.

2. **Current mission relevance**
   - exact current mission mappings rank highest among eligible topics.

3. **Barrier relevance**
   - primary barrier matches rank ahead of secondary/no barrier matches.

4. **Passport weakness relevance**
   - red pillar match ranks ahead of amber pillar match, then unknown where education helps resolve understanding.

5. **Readiness relevance**
   - readiness-specific education provides a tie-break/secondary match, including why waiting can be appropriate.

6. **Novelty tie-break**
   - prefer an unseen `content_key` over a previously shown one where relevance is otherwise equal.

7. **Stable deterministic tie-break**
   - use `content_key` alphabetical order rather than randomness.

If no relevant topic exists, show a specifically designated published fallback article that is safe for the current age/safety context. The implementation must ship at least one `under18_safe` fallback, one `safe_mode_safe` fallback and one normal-adult fallback. It must not manufacture a relevance claim.

### 9.3 Examples

- electoral-roll mission -> electoral roll article;
- high utilisation Passport pillar -> utilisation/headroom article;
- one or more recent applications with amber readiness -> hard vs soft searches/application spacing;
- thin-file diagnosis -> building a credit history/new-to-credit education;
- Safe Mode -> payment stability/missed-payment prevention rather than application encouragement;
- under-18 -> educational credit basics with no product/application CTA.

## 10. Initial curriculum

Launch with at least 25 substantive entries covering the roadmap curriculum without padding the count.

Required topic coverage includes:

- what a credit file is;
- the UK credit reference agencies;
- credit scores versus lender decisions;
- what lenders may consider beyond a score;
- credit utilisation;
- why lower utilisation can help;
- hard versus soft searches;
- application spacing;
- direct debits and payment safeguards;
- missed-payment prevention;
- electoral roll basics;
- account age/credit-history length;
- new-to-credit/thin-file basics;
- new-to-UK credit context, carefully avoiding unsupported claims;
- decline recovery;
- why waiting can be the right action;
- affordability basics;
- correcting inaccurate credit-file data;
- fraud and identity protection;
- mortgage preparation basics;
- car-finance preparation basics;
- revolving credit basics;
- credit limits and headroom;
- eligibility checks and soft searches;
- understanding Application Readiness in Credit Quest;
- understanding the Credit Passport;
- what Credit Quest's internal Quest Score does and does not mean.

Where one concept needs beginner and deeper treatment, separate useful entries are acceptable. Duplicate filler is not.

At least one launch entry must satisfy each protective fallback class: `under18_safe`, `safe_mode_safe`, and normal adult/general.

## 11. Analytics and events

Track useful learning outcomes rather than screen-time optimisation.

Recommended event names:

```text
academy_card_shown
academy_article_opened
academy_article_completed
academy_still_confused
academy_search_used
academy_related_mission_started
```

Event metadata may include:

- `content_key`;
- article version/id;
- source context (`quest_feed`, `learn_home`, `related_article`, `mission`);
- matched reason type (`mission`, `barrier`, `passport`, `readiness`, `fallback`);
- matched non-sensitive identifier such as mission key or pillar ID.

Do not place partner payout, commercial ranking or eligibility outcome data in Academy selection events.

Success metrics should focus on:

- useful article opens from personalised cards;
- article completion where meaningful;
- `still confused` rate;
- linked mission starts/completions;
- search terms with no useful result;
- topic coverage gaps.

Do not optimise for raw screen time, streaks, cards viewed per session or infinite engagement.

## 12. Error and fallback behaviour

- Supabase content-read failure on `/learn`: render a clear temporary-unavailable state; do not substitute unreviewed hard-coded financial content.
- Personalised selector with no eligible match: use the reviewed protective fallback for the current context.
- Missing or invalid profile state: selection must remain conservative and avoid personalised claims that require missing evidence.
- Unpublished slug: return not found.
- Progress-write failure: article remains readable; learning progress is non-critical and should fail safely.
- If the Academy data source is unavailable, core dashboard missions/readiness/passport must continue functioning. The Academy card may degrade to a clearly unavailable education state or be omitted without changing the other feed guidance. Academy must not become a dependency for core guidance availability.

## 13. Security and RLS

The Academy introduces public content, so read/write boundaries must be explicit.

`academy_articles`:

- anonymous/authenticated users: SELECT published rows only;
- authoring/publishing: server/admin role only;
- no browser-side insert/update/delete rights.

`academy_progress`:

- authenticated users: SELECT own rows only;
- anonymous users: no progress rows;
- direct browser writes are denied;
- authenticated server routes own progress writes and validate event semantics.

Database migrations follow the established expand -> deploy -> verify discipline. No destructive cutover is needed for the first Academy slice.

## 14. Testing strategy

### 14.1 Data/schema tests

Verify:

- publication-state constraints;
- one published version per `content_key`/slug;
- version uniqueness;
- allowed mapping/safety-tag values;
- public reads expose published rows only;
- non-public states are not anonymously readable;
- public clients cannot author/publish Academy content;
- progress SELECT isolates users;
- direct browser progress writes are denied.

### 14.2 Domain selector tests

Verify at minimum:

- under-18 filter wins before relevance;
- Safe Mode filter wins before relevance;
- application/borrowing-oriented tags cannot bypass protective filtering;
- exact mission match wins;
- primary barrier match wins when mission has no match;
- red Passport pillar outranks amber;
- readiness match works as lower-priority relevance;
- unseen content wins equal-relevance tie;
- deterministic `content_key` tie-break;
- correct protective fallback when no match;
- selector input has no commercial fields.

### 14.3 Component/content-rendering tests

Verify:

- Academy card includes readable title/summary/context reason;
- no sponsored/commercial labelling exists inside Academy component inputs;
- article provenance/review date renders appropriately;
- `Still confused?` control is accessible;
- unpublished article data cannot be rendered through public component path;
- raw HTML/script/iframe content is not executed from `body_markdown`.

### 14.4 Playwright/E2E

Verify:

- `/learn` is public;
- a published `/learn/[slug]` article renders without authentication;
- unknown/unpublished slug is not publicly available;
- completed onboarding produces a seven-card Quest Feed;
- relevant Academy card is selected for a known mission case;
- under-18 case shows `under18_safe` education and no credit-product CTA;
- Safe Mode case shows `safe_mode_safe` protective education;
- `Learn more` opens the canonical article;
- progress-write failure does not break article reading/core guidance;
- existing mission action, Passport, Readiness and offer-separation behavior still passes.

### 14.5 Release gate

Before merge:

```text
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run test:e2e
npm run build
```

Database migration/advisor checks are required because this slice adds schema.

## 15. Content quality workflow

Every launch article must have:

- a named source or authoritative basis;
- reviewer attribution;
- reviewed date;
- sensitivity classification;
- controlled safety/audience mappings;
- plain-English 20-second summary;
- restricted-Markdown full article body;
- correct mission/barrier/passport/readiness mappings where used;
- no unsupported lender-specific claims;
- no commercial placement hidden as education.

High-sensitivity or regulated-adjacent topics should use authoritative UK sources and conservative wording.

The content team should review stale or time-sensitive articles by `review_due_at`. Expired review dates do not automatically rewrite, unpublish or hallucinate content; they create an editorial maintenance obligation. A later admin workflow may add alerts/queues for overdue review.

## 16. Out of scope for this slice

The following are explicitly deferred:

- full admin/CMS UI;
- external CMS vendor;
- AI-generated Academy decisions/content publication;
- CRA integration;
- Open Banking integration;
- lender-specific eligibility criteria;
- live lender/credit-broker integrations;
- sponsored campaign inventory;
- partner-specific Academy ranking;
- gamified learning streaks;
- infinite educational feeds;
- push notifications;
- advanced semantic/vector search;
- localisation beyond the initial UK English experience.

## 17. Delivery sequence

Recommended implementation order:

1. Academy contracts + schema/RLS migration.
2. Seed-quality canonical launch content, including protective fallbacks.
3. Server repository/query/publish/progress layer.
4. Restricted Markdown renderer.
5. Public `/learn` and `/learn/[slug]` surfaces + SEO/sitemap.
6. Deterministic Academy selector.
7. Academy card and seven-card Quest Feed integration.
8. Progress/events and `Still confused?` feedback.
9. Protective under-18/Safe Mode E2E tests.
10. Full CI/build/database/advisor/release verification.

The later speed-to-market phase can add a lightweight internal editor on top of these same records without changing the customer-facing contracts.

## 18. Definition of done

V2.1 Academy is complete when:

- at least 25 launch-quality reviewed entries exist in the canonical Supabase source;
- public `/learn` and article routes work from published content;
- published content can be changed through controlled content tooling without an application redeploy;
- the Quest Feed has one personalised Academy card and remains finite;
- selection is deterministic and commercially isolated;
- under-18 and Safe Mode filtering is enforced before selection;
- protective fallback content exists for under-18, Safe Mode and normal adult contexts;
- public/private RLS boundaries and server-owned progress writes are proven;
- content provenance/version/review data is preserved;
- restricted Markdown cannot execute raw article-supplied HTML/script/iframe content;
- useful learning analytics exist without addictive engagement mechanics;
- existing Credit Quest strategy, mission, Passport, Readiness and offer behavior remains regression-safe;
- full CI, E2E, build and database checks pass before release.
