import { Router } from "express";
import { requireRole } from "../../middleware/rbac.js";
import { listTasks } from "../tasks/tasks.service.js";

const router = Router();

router.use(requireRole(["worker"]));

router.get("/dashboard", (req, res) => {
  res.json({
    user: req.user,
    quickActions: ["check_in", "check_out", "upload_proof"],
    taskSummary: {
      assigned: listTasks({ assignedTo: req.user!.id }).length
    }
  });
});

router.get("/tasks", (req, res) => {
  res.json({
    items: listTasks({ assignedTo: req.user!.id })
  });
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
