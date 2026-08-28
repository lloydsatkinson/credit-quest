import { describe, expect, it } from "vitest";
import type { AcademyArticle, AcademySelectionContext } from "@/lib/academy/types";

function acceptsArticle(value: AcademyArticle) { return value; }
function acceptsContext(value: AcademySelectionContext) { return value; }

describe("Academy contracts", () => {
  it("resolves the Academy contract module", async () => {
    expect(await import("@/lib/academy/types")).toBeDefined();
  });

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
