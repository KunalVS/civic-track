import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../../middleware/rbac.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { getDashboardOverview } from "../dashboard/dashboard.service.js";
import { listGeofences } from "../geofences/geofences.service.js";
import { createTask, listAssignableWorkers, listTasks } from "../tasks/tasks.service.js";
import { emitTaskAssigned, getLatestWorkerLocations } from "../tracking/tracking.socket.js";

const router = Router();

const optionalDateTime = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid due date")
  .transform((value) => new Date(value).toISOString())
  .optional();

router.use(requireRole(["supervisor"]));

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await getDashboardOverview({ wardId: req.user?.wardId ?? undefined }));
  } catch (error) {
    next(error);
  }
});

router.get("/tasks", async (_req, res, next) => {
  try {
    res.json({ items: await listTasks() });
  } catch (error) {
    next(error);
  }
});

router.get("/resources", async (req, res, next) => {
  try {
    res.json({
      workers: await listAssignableWorkers(req.user?.wardId ?? undefined),
      geofences: await listGeofences(req.user?.wardId ?? undefined)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/tasks", async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(3),
        description: z.string().optional(),
        geofenceId: z.string().min(1),
        assignedTo: z.string().uuid(),
        dueAt: optionalDateTime,
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        expectedPhotoCount: z.number().int().min(1).max(20).optional()
      })
      .parse(req.body);

    const task = await createTask(body, "supervisor", req.user!.id);
    emitTaskAssigned(task);

    await writeAuditLog(req, {
      targetTable: "tasks",
      targetId: task.id,
      activityType: "task_update",
      action: "supervisor_task_created",
      diff: body
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.get("/team/live", (_req, res) => {
  res.json({ items: getLatestWorkerLocations() });
});

export const supervisorRouter = router;
