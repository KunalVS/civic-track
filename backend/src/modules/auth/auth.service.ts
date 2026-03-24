import { createHash } from "node:crypto";
import { eq, isNull, gt, sql, and } from "drizzle-orm";
import type { AuthUser } from "@civictrack/shared";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { admins, authSessions, supervisors, users, workers } from "../../db/schema.js";
import { HttpError } from "../../lib/http-error.js";
import { signAccessToken } from "../../lib/jwt.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";

interface SignupPayload {
  fullName: string;
  phone: string;
  role: "worker" | "supervisor";
  aadhaarNumber: string;
  wardId?: string | null;
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function buildAadhaarRef(aadhaarNumber: string) {
  const digest = createHash("sha256").update(aadhaarNumber).digest("hex").slice(0, 24);
  return `aadhaar-${digest}`;
}

function buildEmployeeCode(role: "worker" | "supervisor", sequence: number) {
  return `${role === "worker" ? "WRK" : "SUP"}-${String(sequence).padStart(4, "0")}`;
}

function toAuthUser(record: typeof users.$inferSelect): AuthUser {
  return {
    id: record.id,
    fullName: record.fullName,
    phone: record.phone,
    email: record.email,
    role: record.role,
    wardId: record.wardId
  };
}

export async function signupUser(payload: SignupPayload) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.phone} = ${payload.phone} OR ${users.email} = ${payload.email}`)
    .limit(1);

  if (existing.length > 0) {
    throw new HttpError(409, "A user with this phone or email already exists");
  }

  const existingAadhaar = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.aadhaarRef, buildAadhaarRef(payload.aadhaarNumber)))
    .limit(1);

  if (existingAadhaar.length > 0) {
    throw new HttpError(409, "An account with this Aadhaar number already exists");
  }

  const roleTableCount =
    payload.role === "worker"
      ? await db.select({ count: sql<number>`count(*)` }).from(workers)
      : await db.select({ count: sql<number>`count(*)` }).from(supervisors);

  const employeeCode = buildEmployeeCode(payload.role, Number(roleTableCount[0]?.count ?? 0) + 1);
  const passwordHash = hashPassword(payload.password);

  const createdUser = await db.transaction(async (tx) => {
    const [userRecord] = await tx
      .insert(users)
      .values({
        aadhaarRef: buildAadhaarRef(payload.aadhaarNumber),
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        passwordHash,
        role: payload.role,
        wardId: payload.wardId ?? null,
        isActive: true
      })
      .returning();

    if (!userRecord) {
      throw new HttpError(500, "Failed to create user");
    }

    if (payload.role === "worker") {
      await tx.insert(workers).values({
        userId: userRecord.id,
        employeeCode,
        department: "Municipal Operations"
      });
    } else {
      await tx.insert(supervisors).values({
        userId: userRecord.id,
        employeeCode,
        zoneName: "Default Zone"
      });
    }

    return userRecord;
  });

  return {
    success: true,
    user: toAuthUser(createdUser),
    message: "Account created. Login with your email and password."
  };
}

export async function loginWithPassword(payload: LoginPayload) {
  const [userRecord] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, payload.email), eq(users.isActive, true)))
    .limit(1);

  if (!userRecord) {
    throw new HttpError(404, "No active account exists for that email");
  }

  if (!verifyPassword(payload.password, userRecord.passwordHash)) {
    throw new HttpError(401, "Invalid email or password");
  }

  const [session] = await db
    .insert(authSessions)
    .values({
      userId: userRecord.id,
      role: userRecord.role,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
      expiresAt: new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000)
    })
    .returning();

  if (!session) {
    throw new HttpError(500, "Failed to create login session");
  }

  const authUser = toAuthUser(userRecord);

  return {
    user: authUser,
    accessToken: signAccessToken(authUser, session.id),
    sessionId: session.id
  };
}

export async function getUserById(userId: string) {
  const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return userRecord ? toAuthUser(userRecord) : null;
}

export async function getSessionById(sessionId: string) {
  const [session] = await db
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date())))
    .limit(1);

  return session ?? null;
}

export async function revokeSession(sessionId: string) {
  await db
    .update(authSessions)
    .set({
      revokedAt: new Date()
    })
    .where(eq(authSessions.id, sessionId));
}

export async function ensureSingleAdminExists() {
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(admins);
  if (Number(countRow?.count ?? 0) !== 1) {
    throw new HttpError(500, "Admin account is not initialized correctly in the database");
  }
}
