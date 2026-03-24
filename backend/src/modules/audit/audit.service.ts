import type { Request } from "express";
import { db } from "../../db/client.js";
import { auditLogs } from "../../db/schema.js";

interface AuditPayload {
  targetTable: string;
  targetId?: string;
  activityType: "login" | "attendance" | "task_update" | "location_ping" | "data_change";
  action: string;
  diff?: Record<string, unknown>;
}

export async function writeAuditLog(req: Request, payload: AuditPayload) {
  const record = {
    actorUserId: req.user?.id ?? null,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] ?? null,
    ...payload
  };

  try {
    await db.insert(auditLogs).values(record);
  } catch (error) {
    console.error("Failed to persist audit log", error);
  }

  return record;
}
