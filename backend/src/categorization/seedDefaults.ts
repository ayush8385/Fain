import { prisma } from "../db/prisma";
import { DEFAULT_CATEGORIES, DEFAULT_MERCHANT_RULES } from "./defaultRules";

/**
 * Ensures global categories exist and seeds the user's MerchantCategoryRule
 * table with well-known merchant patterns. Safe to call on every login —
 * upserts are idempotent so repeat calls are a no-op for already-seeded data.
 */
export async function seedUserDefaults(userId: string): Promise<void> {
  // Ensure all global categories exist (userId=null = global).
  // createMany skipDuplicates guards against concurrent first-logins.
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ name: c.name, icon: c.icon, userId: null })),
    skipDuplicates: true,
  });

  const globalCategories = await prisma.category.findMany({
    where: { userId: null },
    select: { id: true, name: true },
  });
  const categoryByName = new Map(globalCategories.map((c) => [c.name, c.id]));

  // Seed per-user merchant rules for patterns that map to a known global category.
  const rulesToSeed = DEFAULT_MERCHANT_RULES.flatMap((rule) => {
    const categoryId = categoryByName.get(rule.categoryName);
    if (!categoryId) return [];
    return [{ userId, merchantPattern: rule.merchantPattern, categoryId }];
  });

  for (const rule of rulesToSeed) {
    await prisma.merchantCategoryRule.upsert({
      where: { userId_merchantPattern: { userId: rule.userId, merchantPattern: rule.merchantPattern } },
      update: {}, // already seeded — leave confirmedCount as-is
      create: { ...rule, confirmedCount: 1 },
    });
  }
}
