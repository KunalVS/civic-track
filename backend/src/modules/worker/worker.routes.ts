import { Router } from "express";
import { requireRole } from "../../middleware/rbac.js";
import { getAttendanceSummary } from "../attendance/attendance.service.js";
import { listTasks } from "../tasks/tasks.service.js";

const router = Router();

router.use(requireRole(["worker"]));

router.get("/dashboard", async (req, res, next) => {
  try {
    const assignedTasks = await listTasks({ assignedTo: req.user!.id });
    const attendance = await getAttendanceSummary(req.user!.id);

    res.json({
      user: req.user,
      attendance,
      status: assignedTasks.length > 0 ? "active" : "idle",
      taskSummary: {
        assigned: assignedTasks.length
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tasks", async (req, res, next) => {
  try {
    res.json({
      items: await listTasks({ assignedTo: req.user!.id })
    });
  } catch (error) {
    next(error);
  }
});

router.get("/attendance", (_req, res) => {
  res.json({
    items: [
      {
        id: "att_worker_1",
        type: "check_in",
        capturedAt: new Date().toISOString(),
        withinGeofence: true
      }
    ]
  });
});

export const workerRouter = router;
