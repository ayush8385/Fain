import { Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../auth/session";
import { prisma } from "../db/prisma";

export const transactionsRouter = Router();

// GET /transactions?status=needs_review&limit=50&offset=0
transactionsRouter.get("/transactions", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = Math.max(parseInt(offset, 10) || 0, 0);

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId!,
        ...(status ? { status } : {}),
      },
      include: { category: true },
      orderBy: { transactionDate: "desc" },
      take,
      skip,
    });
    res.json(transactions);
  } catch (error) {
    console.error("[transactions] list failed:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// PATCH /transactions/:id/category — user sets or corrects a category.
// Also upserts a MerchantCategoryRule so the same merchant is auto-categorized next time.
transactionsRouter.patch("/transactions/:id/category", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { categoryId } = req.body as { categoryId?: unknown };

  if (typeof categoryId !== "string" || !categoryId.trim()) {
    res.status(400).json({ error: "categoryId is required" });
    return;
  }

  try {
    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction || transaction.userId !== req.userId!) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      res.status(400).json({ error: "Invalid categoryId" });
      return;
    }

    // Update the transaction
    const updated = await prisma.transaction.update({
      where: { id },
      data: { categoryId, status: "confirmed", categoryConfidence: 1.0 },
      include: { category: true },
    });

    // Upsert the merchant rule so future transactions from this merchant
    // are auto-categorized. If a rule already exists for a different category,
    // override it and reset the count — the user's explicit correction wins.
    await prisma.merchantCategoryRule.upsert({
      where: {
        userId_merchantPattern: {
          userId: req.userId!,
          merchantPattern: transaction.merchantNormalized,
        },
      },
      update: { categoryId, confirmedCount: { increment: 1 } },
      create: {
        userId: req.userId!,
        merchantPattern: transaction.merchantNormalized,
        categoryId,
        confirmedCount: 1,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("[transactions] patch category failed:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});
