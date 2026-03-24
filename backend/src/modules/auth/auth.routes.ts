import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { requireAuth } from "../../middleware/auth.js";
import { verifyAccessToken } from "../../lib/jwt.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { ensureSingleAdminExists, getUserById, loginWithPassword, revokeSession, signupUser } from "./auth.service.js";

const router = Router();
const mockEkycRouter = Router();

router.post("/signup", async (req, res, next) => {
  try {
    const body = z
      .object({
        fullName: z.string().min(3),
        phone: z.string().length(10),
        role: z.enum(["worker", "supervisor"]),
        aadhaarNumber: z.string().length(12),
        wardId: z.string().uuid().optional().nullable(),
        email: z.string().email(),
        password: z.string().min(8)
      })
      .parse(req.body);

    await ensureSingleAdminExists();
    const result = await signupUser(body);

    await writeAuditLog(req, {
      targetTable: "users",
      targetId: result.user.id,
      activityType: "login",
      action: "signup_completed",
      diff: {
        phone: body.phone,
        email: body.email,
        role: body.role
      }
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8)
      })
      .parse(req.body);

    const result = await loginWithPassword({
      ...body,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null
    });

    await writeAuditLog(req, {
      targetTable: "users",
      targetId: result.user.id,
      activityType: "login",
      action: "login_password_verified"
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "Missing bearer token");
    }

    const payload = verifyAccessToken(header.slice(7));
    await revokeSession(payload.sessionId);

    await writeAuditLog(req, {
      targetTable: "auth_sessions",
      targetId: payload.sessionId,
      activityType: "login",
      action: "logout"
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/ekyc/login", async (req, res, next) => {
  try {
    const body = z
      .object({
        userId: z.string().uuid()
      })
      .parse(req.body);

    const user = await getUserById(body.userId);
    if (!user) {
      throw new HttpError(404, "User not found");
    }

    await writeAuditLog(req, {
      targetTable: "users",
      targetId: user.id,
      activityType: "login",
      action: "ekyc_lookup_success"
    });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

mockEkycRouter.post("/verify", (req, res) => {
  res.json({
    success: true,
    name: "Hackathon User",
    referenceId: `ekyc_${Date.now()}`,
    payload: req.body
  });
});

export const authRouter = router;
export { mockEkycRouter };
