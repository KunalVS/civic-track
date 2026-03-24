import type { NextFunction, Request, Response } from "express";
import { getSessionById } from "../modules/auth/auth.service.js";
import { verifyAccessToken } from "../lib/jwt.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    const session = await getSessionById(payload.sessionId);

    if (!session) {
      return res.status(401).json({ message: "Session expired or revoked" });
    }

    req.user = {
      id: payload.id,
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      role: payload.role,
      wardId: payload.wardId
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
