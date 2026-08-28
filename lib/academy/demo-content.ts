import type { AcademyArticle } from "@/lib/academy/types";

const REVIEWED_AT = "2026-08-28T00:00:00.000Z";
const PUBLISHED_AT = "2026-08-28T00:00:00.000Z";

function demoArticle(
  value: Omit<AcademyArticle, "id" | "version" | "status" | "supersedesId" | "reviewer" | "reviewedAt" | "reviewDueAt" | "publishedAt" | "createdAt" | "updatedAt">,
  index: number,
): AcademyArticle {
  const suffix = String(index).padStart(12, "0");
  return {
    ...value,
    id: `00000000-0000-0000-0000-${suffix}`,
    version: 1,
    status: "published",
    supersedesId: null,
    reviewer: "Credit Quest Editorial",
    reviewedAt: REVIEWED_AT,
    reviewDueAt: null,
    publishedAt: PUBLISHED_AT,
    createdAt: PUBLISHED_AT,
    updatedAt: PUBLISHED_AT,
  };
}

/**
 * Reviewed demo/test content only.
 * Use this fixture only when Supabase is not configured. A configured
 * production Academy read failure must never silently fall back to this data.
 */
export const DEMO_ACADEMY_ARTICLES: AcademyArticle[] = [
  demoArticle({
    contentKey: "credit-file-basics",
    slug: "what-is-a-credit-file",
    title: "What is a credit file?",
    summary20s: "A credit file records credit-related information about you. Lenders may use it as one input, but it is not itself a lending decision.",
    bodyMarkdown: "## The short version\nA credit file can include accounts, payment history, credit searches and public-record information. Credit reference agencies organise this information, while each lender applies its own criteria.\n\n## What to remember\n- Check that information is accurate.\n- A credit score is not a guarantee of acceptance.\n- Build good habits rather than chasing a number.",
    readingMinutes: 2,
    topicTags: ["credit-file", "basics"],
    audiences: ["general", "adult"],
    missionKeys: [],
    barrierTypes: [],
    passportPillars: [],
    readinessStates: [],
    safetyTags: ["general"],
    sensitivity: "standard",
    sourceName: "MoneyHelper / ICO",
    sourceUrl: "https://ico.org.uk/for-the-public/credit/",
  }, 1),
  demoArticle({
    contentKey: "credit-basics-under-18",
    slug: "credit-basics-before-18",
    title: "Credit basics before 18",
    summary20s: "You do not need to borrow to prepare for adult credit. Learning how files, payments and applications work is useful preparation on its own.",
    bodyMarkdown: "## Learn first\nBefore 18, Credit Quest keeps the focus on understanding credit rather than applying for products.\n\n## Useful preparation\n- Learn what a credit file contains.\n- Understand why paying bills on time matters.\n- Know the difference between a hard and soft search.\n- Protect personal information from fraud.",
    readingMinutes: 2,
    topicTags: ["basics", "under-18"],
    audiences: ["under18"],
    missionKeys: [],
    barrierTypes: [],
    passportPillars: [],
    readinessStates: ["unknown"],
    safetyTags: ["under18_safe"],
    sensitivity: "standard",
    sourceName: "Credit Quest education rules / MoneyHelper",
    sourceUrl: "https://www.moneyhelper.org.uk/",
  }, 2),
  demoArticle({
    contentKey: "protect-payments-first",
    slug: "protect-payments-first",
    title: "Protect payments first",
    summary20s: "When finances are under pressure, keeping existing commitments stable is usually more useful than adding another credit application.",
    bodyMarkdown: "## Stability first\nCredit Quest Safe Mode pauses product suggestions so attention stays on protecting current payments and avoiding unnecessary new borrowing.\n\n## Practical priorities\n- Know what is due and when.\n- Use payment reminders or safeguards where appropriate.\n- Contact a provider early if you are struggling.\n- Avoid using a new application as a test of whether things have improved.",
    readingMinutes: 2,
    topicTags: ["payments", "safe-mode"],
    audiences: ["adult"],
    missionKeys: [],
    barrierTypes: ["credit_rebuilder"],
    passportPillars: ["payment_health"],
    readinessStates: ["red"],
    safetyTags: ["safe_mode_safe"],
    sensitivity: "sensitive",
    sourceName: "Credit Quest Safe Mode rules / MoneyHelper",
    sourceUrl: "https://www.moneyhelper.org.uk/",
  }, 3),
  demoArticle({
    contentKey: "electoral-roll-basics",
    slug: "electoral-roll-basics",
    title: "Why the electoral roll can matter",
    summary20s: "Electoral-roll information can help organisations verify identity and address details. Register only if you are eligible to vote in the UK.",
    bodyMarkdown: "## Identity and address matching\nBeing correctly registered can help with identity and address verification. It does not guarantee credit approval.\n\n## If it applies to you\nUse the official GOV.UK registration service and keep your current address details accurate.",
    readingMinutes: 2,
    topicTags: ["identity", "electoral-roll"],
    audiences: ["adult"],
    missionKeys: ["register-electoral-roll"],
    barrierTypes: [],
    passportPillars: ["identity"],
    readinessStates: [],
    safetyTags: ["general"],
    sensitivity: "standard",
    sourceName: "GOV.UK / MoneyHelper",
    sourceUrl: "https://www.gov.uk/register-to-vote",
  }, 4),
  demoArticle({
    contentKey: "application-spacing",
    slug: "application-spacing",
    title: "Why spacing applications can help",
    summary20s: "Several hard applications close together create repeated search footprints. Waiting can be more useful than making another unnecessary application.",
    bodyMarkdown: "## Fewer unnecessary hard searches\nA hard credit application normally leaves a search footprint on your credit file. Different lenders make their own decisions, so Credit Quest does not prescribe a universal waiting period.\n\n## Better approach\nUnderstand your current position, improve what you can control, and use a soft eligibility check where an appropriate one is available.",
    readingMinutes: 2,
    topicTags: ["applications", "searches"],
    audiences: ["adult"],
    missionKeys: ["application-cooldown"],
    barrierTypes: ["optimiser"],
    passportPillars: ["application_readiness"],
    readinessStates: ["amber", "red"],
    safetyTags: ["general", "application_oriented"],
    sensitivity: "regulated_adjacent",
    sourceName: "MoneyHelper",
    sourceUrl: "https://www.moneyhelper.org.uk/",
  }, 5),
];
