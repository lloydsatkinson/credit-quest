import { describe, expect, it } from "vitest";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import { selectAcademyArticle } from "@/lib/academy/selector";
import type { AcademyArticle, AcademySelectionContext } from "@/lib/academy/types";
import type { CreditPassport } from "@/lib/domain/types";

const baseArticle = DEMO_ACADEMY_ARTICLES[0];

function article(contentKey: string, overrides: Partial<AcademyArticle> = {}): AcademyArticle {
  return {
    ...baseArticle,
    id: `00000000-0000-0000-0000-${contentKey.padEnd(12, "0").slice(0, 12).replace(/[^0-9a-f]/g, "a")}`,
    contentKey,
    slug: contentKey,
    title: contentKey,
    topicTags: [contentKey],
    missionKeys: [],
    barrierTypes: [],
    passportPillars: [],
    readinessStates: [],
    safetyTags: ["general"],
    ...overrides,
  };
}

const greenReadiness = {
  state: "green" as const,
  headline: "Worth checking eligibility",
  reasons: [],
  avoid: [],
  actions: [],
  reassessAt: null,
  daysUntilReassessment: null,
};

const neutralPassport: CreditPassport = { pillars: [] };

const adultContext: AcademySelectionContext = {
  ageMode: "adult",
  safety: { mode: "normal", reasons: [], suppressOffers: false },
  missionKey: null,
  diagnosis: { primary: null, secondary: [], confidence: "low", factors: [] },
  passport: neutralPassport,
  readiness: greenReadiness,
  seenContentKeys: [],
};

function passport(status: "green" | "amber" | "red" | "unknown", id: CreditPassport["pillars"][number]["id"]): CreditPassport {
  return {
    pillars: [{
      id,
      title: id,
      status,
      strength: "",
      helping: [],
      hurting: [],
      unknowns: [],
      nextActions: [],
    }],
  };
}

describe("Academy selector", () => {
  it("uses the under-18 protective fallback before any relevance ranking", () => {
    const context: AcademySelectionContext = {
      ...adultContext,
      ageMode: "education",
      readiness: { ...greenReadiness, state: "unknown", headline: "Products can wait" },
    };
    expect(selectAcademyArticle(DEMO_ACADEMY_ARTICLES, context)?.article.contentKey).toBe("credit-basics-under-18");
  });

  it("uses the Safe Mode protective fallback before any relevance ranking", () => {
    const context: AcademySelectionContext = {
      ...adultContext,
      safety: { mode: "safe_mode", reasons: ["Protect payments first"], suppressOffers: true },
      readiness: { ...greenReadiness, state: "red", headline: "Do not apply yet" },
    };
    expect(selectAcademyArticle(DEMO_ACADEMY_ARTICLES, context)?.article.contentKey).toBe("protect-payments-first");
  });

  it("prioritises an exact current mission", () => {
    expect(selectAcademyArticle(
      DEMO_ACADEMY_ARTICLES,
      { ...adultContext, missionKey: "register-electoral-roll" },
    )?.article.contentKey).toBe("electoral-roll-basics");
  });

  it("ranks primary barrier above Passport and readiness matches", () => {
    const barrier = article("barrier", { barrierTypes: ["thin_file"] });
    const passportMatch = article("passport", { passportPillars: ["payment_health"] });
    const readiness = article("readiness", { readinessStates: ["green"] });
    const context: AcademySelectionContext = {
      ...adultContext,
      diagnosis: { primary: "thin_file", secondary: [], confidence: "medium", factors: [] },
      passport: passport("red", "payment_health"),
    };
    expect(selectAcademyArticle([barrier, passportMatch, readiness, baseArticle], context)?.article.contentKey).toBe("barrier");
  });

  it("ranks a red Passport match above amber and unknown Passport matches", () => {
    const red = article("red-passport", { passportPillars: ["payment_health"] });
    const amber = article("amber-passport", { passportPillars: ["debt_headroom"] });
    const unknown = article("unknown-passport", { passportPillars: ["affordability_stability"] });
    const context: AcademySelectionContext = {
      ...adultContext,
      passport: {
        pillars: [
          { ...passport("red", "payment_health").pillars[0] },
          { ...passport("amber", "debt_headroom").pillars[0] },
          { ...passport("unknown", "affordability_stability").pillars[0] },
        ],
      },
    };
    expect(selectAcademyArticle([amber, unknown, red, baseArticle], context)?.article.contentKey).toBe("red-passport");
  });

  it("uses readiness only after higher-priority Passport relevance", () => {
    const passportMatch = article("passport-first", { passportPillars: ["payment_health"] });
    const readinessMatch = article("readiness-second", { readinessStates: ["green"] });
    const context = { ...adultContext, passport: passport("amber", "payment_health") };
    expect(selectAcademyArticle([readinessMatch, passportMatch, baseArticle], context)?.article.contentKey).toBe("passport-first");
  });

  it("prefers unseen content only when relevance is otherwise equal", () => {
    const seen = article("a-seen", { missionKeys: ["same-mission"] });
    const unseen = article("z-unseen", { missionKeys: ["same-mission"] });
    const context = { ...adultContext, missionKey: "same-mission", seenContentKeys: ["a-seen"] };
    expect(selectAcademyArticle([seen, unseen, baseArticle], context)?.article.contentKey).toBe("z-unseen");
  });

  it("uses contentKey alphabetical order as the final deterministic tie-break", () => {
    const alpha = article("alpha");
    const beta = article("beta");
    expect(selectAcademyArticle([beta, alpha], adultContext)?.article.contentKey).toBe("alpha");
  });

  it("falls back to the exact normal adult foundation when nothing else is relevant", () => {
    expect(selectAcademyArticle([DEMO_ACADEMY_ARTICLES[0]], adultContext)?.article.contentKey).toBe("credit-file-basics");
    expect(selectAcademyArticle([], adultContext)).toBeNull();
  });

  it("never selects application or borrowing-oriented content before green readiness", () => {
    const restricted = article("restricted", {
      missionKeys: ["urgent-looking-mission"],
      safetyTags: ["general", "application_oriented"],
    });
    const fallback = DEMO_ACADEMY_ARTICLES[0];
    const context: AcademySelectionContext = {
      ...adultContext,
      missionKey: "urgent-looking-mission",
      readiness: { ...greenReadiness, state: "red", headline: "Do not apply yet" },
    };
    expect(selectAcademyArticle([restricted, fallback], context)?.article.contentKey).toBe("credit-file-basics");
  });

  it("uses the approved explanation copy for every winning dimension", () => {
    const mission = article("mission-copy", { missionKeys: ["mission-key"] });
    expect(selectAcademyArticle([mission], { ...adultContext, missionKey: "mission-key" })?.whyThisMatters)
      .toBe("This explains the action Credit Quest has ranked for you right now.");

    const barrier = article("barrier-copy", { barrierTypes: ["thin_file"] });
    expect(selectAcademyArticle([barrier], {
      ...adultContext,
      diagnosis: { primary: "thin_file", secondary: [], confidence: "medium", factors: [] },
    })?.whyThisMatters).toBe("This explains the main credit-building barrier Credit Quest has identified.");

    const passportArticle = article("passport-copy", { passportPillars: ["payment_health"] });
    expect(selectAcademyArticle([passportArticle], {
      ...adultContext,
      passport: passport("red", "payment_health"),
    })?.whyThisMatters).toBe("This explains a Credit Passport area that currently needs attention.");

    const readinessArticle = article("readiness-copy", { readinessStates: ["green"] });
    expect(selectAcademyArticle([readinessArticle], adultContext)?.whyThisMatters)
      .toBe("This helps explain your current application-readiness guidance.");

    expect(selectAcademyArticle([baseArticle], adultContext)?.whyThisMatters)
      .toBe("A useful foundation for understanding your next steps in Credit Quest.");
  });
});
