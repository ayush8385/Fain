import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

interface SessionPayload {
  userId: string;
}

export function issueSessionToken(userId: string): string {
  return jwt.sign({ userId } satisfies SessionPayload, env.sessionJwtSecret, {
    expiresIn: "30d",
  });
}

export function verifySessionToken(token: string): SessionPayload {
  return jwt.verify(token, env.sessionJwtSecret) as SessionPayload;
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const payload = verifySessionToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
