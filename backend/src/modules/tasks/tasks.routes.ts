import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../../middleware/rbac.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { buildTaskProof, createTask, listTasks } from "./tasks.service.js";

const router = Router();

router.get("/", (req, res) => {
  const query = {
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    assignedTo: typeof req.query.assignedTo === "string" ? req.query.assignedTo : undefined
  };

  res.json({
    items: listTasks(query)
  });
});

router.post("/", requireRole(["supervisor", "admin"]), async (req, res, next) => {
  try {
    const body = z.object({
      title: z.string().min(3),
      description: z.string().optional(),
      assignedTo: z.string().uuid(),
      geofenceId: z.string().uuid().optional(),
      dueAt: z.string().datetime().optional()
    }).parse(req.body);

    await writeAuditLog(req, {
      targetTable: "tasks",
      activityType: "task_update",
      action: "task_created",
      diff: body
    });

    res.status(201).json(createTask(body, req.user!.role));
  } catch (error) {
    next(error);
  }
});

router.post("/:taskId/proofs", requireRole(["worker", "supervisor", "admin"]), async (req, res, next) => {
  try {
    const body = z.object({
      imageUrl: z.string().url(),
      latitude: z.number(),
      longitude: z.number(),
      capturedAt: z.string().datetime(),
      metadata: z.record(z.any()).optional()
    }).parse(req.body);

    await writeAuditLog(req, {
      targetTable: "task_proofs",
      targetId: String(req.params.taskId),
      activityType: "task_update",
      action: "proof_uploaded",
      diff: body
    });

    res.status(201).json(buildTaskProof(String(req.params.taskId), req.user!.id, body));
  } catch (error) {
    next(error);
  }
});

export const tasksRouter = router;
