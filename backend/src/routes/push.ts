import { Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../auth/session";
import { prisma } from "../db/prisma";

export const pushRouter = Router();

pushRouter.post("/push/register-device", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { token, platform } = req.body as { token?: unknown; platform?: unknown };

  if (typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (platform !== "ios" && platform !== "android") {
    res.status(400).json({ error: "platform must be 'ios' or 'android'" });
    return;
  }

  try {
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: req.userId!, platform, updatedAt: new Date() },
      create: { userId: req.userId!, token, platform },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("[push] register-device failed:", error);
    res.status(500).json({ error: "Failed to register device token" });
  }
});
