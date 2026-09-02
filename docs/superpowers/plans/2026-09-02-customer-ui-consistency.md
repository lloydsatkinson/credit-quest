# Customer UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every customer-facing Credit Quest surface use the current premium dark/neon visual system without changing credit logic, readiness logic, safety logic, Quest Feed count, commercial safeguards, pilot-gate behavior, email flags, or live-referral state.

**Architecture:** Preserve server/domain behavior and route ownership. Migrate presentation through a small semantic customer UI layer and then restyle existing feature components in place. Keep `feat/sandbox-pilot-gate` frozen; this branch starts from `54644b4e648131562396e753e9aa9822920c046a` and is reviewed independently.

**Tech Stack:** Next.js 16.3.3, React 19, Tailwind CSS 4, Vitest, Testing Library, Playwright, Supabase.

**Spec:** Approved UI consistency design from 2026-09-02 conversation.

## Global Constraints

- Do not change core credit logic or readiness rules.
- Do not change safety rules, age gates, mission selection/ranking, or Quest Feed count.
- Do not enable live commercial referrals, sandbox commercial flow, emails, or pilot membership.
- Do not change `commercial_sandbox_enabled`, live-referral flags, or PR #29 pilot-gate semantics.
- Keep admin functional rather than heavily redesigned.
- Use the existing premium dark/neon `CustomerShell`, current page heroes, and sandbox completion view as the source of truth.
- Every production presentation change must be preceded by a failing test and followed by green focused tests before broader verification.

---

### Task 1: Academy visual migration

**Files:**
- Modify: `tests/unit/academy-components.test.tsx`
- Modify: `components/academy/academy-library.tsx`
- Modify: `components/academy/academy-article.tsx`
- Modify: `app/learn/[slug]/page.tsx`

**Interfaces:**
- Consumes: `CustomerShell`, existing `AcademyArticle`, `AcademySearchTracker`, `AcademyArticleTracker`.
- Produces: Academy library/article presentation that stays inside customer navigation and exposes stable `data-testid` hooks for visual contract tests.

- [ ] Add failing tests asserting premium Academy shell hooks, dark semantic panels, article-in-product navigation, and unchanged educational/commercial boundaries.
- [ ] Run focused Academy tests and confirm RED for missing UI contract.
- [ ] Wrap article route in `CustomerShell active="learn"` and migrate library/article cards, search, topic filters, callouts, related links, empty and unavailable states.
- [ ] Run focused Academy tests and confirm GREEN.
- [ ] Commit Academy slice.

### Task 2: Shared form and status presentation

**Files:**
- Create: `components/customer/customer-ui.tsx`
- Create: `tests/unit/customer-ui.test.tsx`
- Modify: `app/globals.css` only where reusable semantic utilities materially reduce duplicated presentation classes.

**Interfaces:**
- Produces: lightweight `CustomerPanel`, `CustomerButton`, `CustomerField`, `CustomerStatus`, and `CustomerState` primitives with presentation-only props.

- [ ] Add failing primitive contract tests for accessible roles, disabled state, semantic tones and dark field presentation.
- [ ] Confirm RED.
- [ ] Implement minimal primitives without business logic.
- [ ] Confirm GREEN and refactor duplicate class strings only after green.
- [ ] Commit shared presentation slice.

### Task 3: Onboarding and login

**Files:**
- Modify: `tests/unit/onboarding-form.test.tsx` or existing onboarding presentation tests.
- Modify: `components/onboarding/onboarding-form.tsx`
- Modify: `app/(auth)/login/page.tsx`

**Interfaces:**
- Preserve `canContinue`, request payloads, localStorage keys, OTP behavior, callbacks and redirects.

- [ ] Add failing tests for premium form contract while preserving all continuation rules and labels.
- [ ] Confirm RED.
- [ ] Migrate progress, inputs, selects, yes/no/unknown controls, errors and navigation buttons; remove the hard-coded white `.field` style.
- [ ] Migrate login into the customer visual system without changing Supabase OTP behavior.
- [ ] Confirm GREEN and commit.

### Task 4: Accounts and profile/customer settings

**Files:**
- Modify: `tests/unit/accounts-client.test.tsx`
- Modify: `components/accounts/accounts-client.tsx`
- Modify customer settings/reminder components discovered during implementation.

**Interfaces:**
- Preserve account validation, API payloads, add/edit/delete behavior, recalculation messages and safe-data warnings.

- [ ] Add failing UI contract tests for add/edit cards, controls, empty and status states.
- [ ] Confirm RED.
- [ ] Migrate presentation only.
- [ ] Confirm GREEN and commit.

### Task 5: Passport and Readiness

**Files:**
- Modify relevant Passport/Readiness unit tests.
- Modify: `components/passport/passport-detail.tsx`
- Modify: `components/readiness/readiness-detail.tsx`
- Modify summary cards only if still visually legacy.

**Interfaces:**
- Preserve all `CreditPassport`, `PassportStatus`, `ApplicationReadiness`, `ReadinessState`, reasons, actions, unknowns and reassessment outputs.

- [ ] Add failing tests for premium status presentation while asserting unchanged labels/content.
- [ ] Confirm RED.
- [ ] Migrate panels and semantic green/amber/red/unknown treatments.
- [ ] Confirm GREEN and commit.

### Task 6: Offers, sandbox presentation and mission actions

**Files:**
- Modify existing offer/commercial/action component tests.
- Modify: `components/offers/offers-client.tsx`
- Modify: `components/offers/offer-card.tsx`
- Modify: `components/commercial/commercial-gateway-card.tsx`
- Modify: `components/actions/action-screen.tsx`
- Modify action/resume state cards if legacy.

**Interfaces:**
- Preserve `listPermittedCommercialRoutes`, referral POST payloads, consent gating, sandbox destination validation, analytics events, action-start API payloads and verification copy.

- [ ] Add failing presentation tests plus protected-behavior assertions.
- [ ] Confirm RED.
- [ ] Migrate presentation only; keep simulation/sandbox distinctions explicit.
- [ ] Confirm GREEN and commit.

### Task 7: Empty, error, loading and navigation consistency

**Files:**
- Modify customer route `loading.tsx`, `error.tsx`, `not-found.tsx` files where present or add shared route states only where routes currently fall back to unstyled framework output.
- Modify relevant tests/e2e specs.

**Interfaces:**
- No data/decision changes.

- [ ] Add failing tests for consistent customer state surfaces and return navigation.
- [ ] Confirm RED.
- [ ] Implement premium neutral/error/loading states.
- [ ] Confirm GREEN and commit.

### Task 8: Full protected-behavior and visual verification

**Files:**
- Modify Playwright specs only to add stable customer-surface checks; do not weaken existing assertions.

- [ ] Run `npm run lint`.
- [ ] Run `npm test` and require all unit/integration tests green.
- [ ] Run `npm audit --omit=dev --audit-level=high`.
- [ ] Run local Supabase migrations and `supabase/tests/rls.sql`, `retention_rls.sql`, and `commercial_rls.sql`.
- [ ] Run `npm run test:e2e` and require all Playwright tests green.
- [ ] Run `npm run build`.
- [ ] Re-fetch PR #29 and verify its head is still `54644b4e648131562396e753e9aa9822920c046a` and draft/unmerged before declaring this UI branch safe.
- [ ] Review branch diff for changes to domain/server/commercial flag logic; any unexpected logic diff blocks completion.
