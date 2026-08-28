import type {
  AcademyArticle,
  AcademyMatchReason,
  AcademySelection,
  AcademySelectionContext,
} from "@/lib/academy/types";
import type { PassportStatus } from "@/lib/domain/types";

const FALLBACKS = {
  education: "credit-basics-under-18",
  safe_mode: "protect-payments-first",
  adult: "credit-file-basics",
} as const;

const PASSPORT_WEIGHT: Record<PassportStatus, number> = {
  red: 3,
  amber: 2,
  unknown: 1,
  green: 0,
};

type RankedArticle = {
  article: AcademyArticle;
  tuple: [number, number, number, number, number];
  reasonType: AcademyMatchReason;
  reasonKey: string | null;
};

function isRestricted(article: AcademyArticle): boolean {
  return article.safetyTags.includes("application_oriented")
    || article.safetyTags.includes("borrowing_oriented");
}

function eligibleArticles(
  articles: AcademyArticle[],
  context: AcademySelectionContext,
): AcademyArticle[] {
  return articles.filter((article) => {
    if (article.status !== "published") return false;

    if (context.ageMode === "education") {
      return article.safetyTags.includes("under18_safe");
    }

    if (context.safety.mode === "safe_mode") {
      return article.safetyTags.includes("safe_mode_safe");
    }

    const restricted = isRestricted(article);
    if (restricted && context.readiness.state !== "green") return false;
    return article.safetyTags.includes("general") || restricted;
  });
}

function passportMatch(
  article: AcademyArticle,
  context: AcademySelectionContext,
): { rank: number; key: string | null } {
  const candidates = context.passport.pillars
    .filter((pillar) => article.passportPillars.includes(pillar.id))
    .map((pillar) => ({ id: pillar.id, rank: PASSPORT_WEIGHT[pillar.status] }))
    .sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id));

  return candidates[0]
    ? { rank: candidates[0].rank, key: candidates[0].id }
    : { rank: 0, key: null };
}

function rankArticle(
  article: AcademyArticle,
  context: AcademySelectionContext,
): RankedArticle {
  const mission = context.missionKey !== null && article.missionKeys.includes(context.missionKey) ? 1 : 0;

  let barrier = 0;
  let barrierKey: string | null = null;
  if (context.diagnosis.primary && article.barrierTypes.includes(context.diagnosis.primary)) {
    barrier = 2;
    barrierKey = context.diagnosis.primary;
  } else {
    const secondary = [...context.diagnosis.secondary]
      .filter((item) => article.barrierTypes.includes(item))
      .sort()[0];
    if (secondary) {
      barrier = 1;
      barrierKey = secondary;
    }
  }

  const passport = passportMatch(article, context);
  const readiness = article.readinessStates.includes(context.readiness.state) ? 1 : 0;
  const novelty = context.seenContentKeys.includes(article.contentKey) ? 0 : 1;

  let reasonType: AcademyMatchReason = "fallback";
  let reasonKey: string | null = null;
  if (mission) {
    reasonType = "mission";
    reasonKey = context.missionKey;
  } else if (barrier) {
    reasonType = "barrier";
    reasonKey = barrierKey;
  } else if (passport.rank) {
    reasonType = "passport";
    reasonKey = passport.key;
  } else if (readiness) {
    reasonType = "readiness";
    reasonKey = context.readiness.state;
  }

  return {
    article,
    tuple: [mission, barrier, passport.rank, readiness, novelty],
    reasonType,
    reasonKey,
  };
}

function compareRank(left: RankedArticle, right: RankedArticle): number {
  for (let index = 0; index < left.tuple.length; index += 1) {
    const difference = right.tuple[index] - left.tuple[index];
    if (difference !== 0) return difference;
  }
  return left.article.contentKey.localeCompare(right.article.contentKey);
}

function hasRelevance(item: RankedArticle): boolean {
  return item.tuple[0] > 0 || item.tuple[1] > 0 || item.tuple[2] > 0 || item.tuple[3] > 0;
}

function fallbackKey(context: AcademySelectionContext): string {
  if (context.ageMode === "education") return FALLBACKS.education;
  if (context.safety.mode === "safe_mode") return FALLBACKS.safe_mode;
  return FALLBACKS.adult;
}

function whyThisMatters(item: RankedArticle): string {
  switch (item.reasonType) {
    case "mission":
      return "This explains the action Credit Quest has ranked for you right now.";
    case "barrier":
      return "This explains the main credit-building barrier Credit Quest has identified.";
    case "passport":
      return "This explains a Credit Passport area that currently needs attention.";
    case "readiness":
      return "This helps explain your current application-readiness guidance.";
    case "fallback":
      return "A useful foundation for understanding your next steps in Credit Quest.";
  }
}

export function selectAcademyArticle(
  articles: AcademyArticle[],
  context: AcademySelectionContext,
): AcademySelection | null {
  const eligible = eligibleArticles(articles, context);
  if (eligible.length === 0) return null;

  const ranked = eligible.map((article) => rankArticle(article, context));
  const relevant = ranked.filter(hasRelevance).sort(compareRank);

  let selected: RankedArticle | undefined = relevant[0];
  if (!selected) {
    const exactFallback = ranked.find((item) => item.article.contentKey === fallbackKey(context));
    selected = exactFallback ?? [...ranked].sort(compareRank)[0];
    if (selected) {
      selected = { ...selected, reasonType: "fallback", reasonKey: null };
    }
  }

  if (!selected) return null;
  return {
    article: selected.article,
    reasonType: selected.reasonType,
    reasonKey: selected.reasonKey,
    whyThisMatters: whyThisMatters(selected),
  };
}
