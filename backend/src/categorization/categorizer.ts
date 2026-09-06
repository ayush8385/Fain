import { prisma } from "../db/prisma";

export interface CategorizationResult {
  categoryId: string;
  confidence: number;
}

/**
 * Matches a normalized merchant name against the user's MerchantCategoryRule
 * table (which includes both system-seeded defaults and user-confirmed rules).
 * Rules are tried in descending confirmedCount order so user-confirmed patterns
 * (which accrue higher counts over time) take priority over seeded defaults.
 */
export async function categorizeMerchant(
  userId: string,
  merchantNormalized: string,
): Promise<CategorizationResult | null> {
  const rules = await prisma.merchantCategoryRule.findMany({
    where: { userId },
    orderBy: { confirmedCount: "desc" },
  });

  for (const rule of rules) {
    if (merchantNormalized.includes(rule.merchantPattern)) {
      // Confidence grows with confirmedCount but never hits 1.0 — leaves room
      // for the user to always override.
      const confidence = rule.confirmedCount / (rule.confirmedCount + 1);
      return { categoryId: rule.categoryId, confidence };
    }
  }

  return null;
}
