import { Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../auth/session";
import { prisma } from "../db/prisma";

export const categoriesRouter = Router();

// Returns global categories (userId=null) merged with the user's custom ones.
categoriesRouter.get("/categories", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: req.userId! }] },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) {
    console.error("[categories] list failed:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

categoriesRouter.post("/categories", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { name, icon } = req.body as { name?: unknown; icon?: unknown };

  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const category = await prisma.category.create({
      data: {
        userId: req.userId!,
        name: name.trim(),
        icon: typeof icon === "string" ? icon.trim() : null,
      },
    });
    res.status(201).json(category);
  } catch (error) {
    console.error("[categories] create failed:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});
