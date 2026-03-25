import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { ensureWorkerLoginAttendanceWithLocation, validateAttendance } from "./attendance.service.js";

const router = Router();

router.post("/auto-login-check-in", async (req, res, next) => {
  try {
    if (req.user?.role !== "worker") {
      throw new HttpError(403, "Only workers can auto-mark login attendance");
    }

    const body = z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        accuracyMeters: z.number().optional(),
        capturedAt: z.string().datetime().optional()
      })
      .parse(req.body);

    const result = await ensureWorkerLoginAttendanceWithLocation(req.user.id, body);

    await writeAuditLog(req, {
      targetTable: "attendance_logs",
      targetId: req.user.id,
      activityType: "attendance",
      action: result.marked ? "auto_login_check_in_created" : result.updatedExisting ? "auto_login_check_in_upgraded" : "auto_login_check_in_skipped",
      diff: {
        ...body,
        result
      }
    });

    res.status(result.marked || result.updatedExisting ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/check-in", async (req, res, next) => {
  try {
    const body = z.object({
      latitude: z.number(),
      longitude: z.number(),
      capturedAt: z.string().datetime(),
      accuracyMeters: z.number().optional(),
      geofence: z.object({
        type: z.literal("radius"),
        centerLat: z.number(),
        centerLng: z.number(),
        radiusMeters: z.number().positive()
      }),
      previousPoint: z.object({
        latitude: z.number(),
        longitude: z.number(),
        capturedAt: z.string().datetime()
      }).optional()
    }).parse(req.body);

    const result = validateAttendance(body);
    await writeAuditLog(req, {
      targetTable: "attendance_logs",
      activityType: "attendance",
      action: "check_in_attempt",
      diff: result
    });

    res.status(result.accepted ? 201 : 422).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/check-out", async (req, res, next) => {
  try {
    const body = z.object({
      latitude: z.number(),
      longitude: z.number(),
      capturedAt: z.string().datetime()
    }).parse(req.body);

    await writeAuditLog(req, {
      targetTable: "attendance_logs",
      activityType: "attendance",
      action: "check_out_attempt",
      diff: body
    });

    res.status(201).json({
      success: true,
      message: "Check-out recorded",
      payload: body
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history", (_req, res) => {
  res.json({
    items: [
      {
        id: "att_1",
        type: "check_in",
        capturedAt: new Date().toISOString(),
        withinGeofence: true
      }
    ]
  });
});

export const attendanceRouter = router;
