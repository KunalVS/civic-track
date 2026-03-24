import { Router } from "express";
import { requireRole } from "../../middleware/rbac.js";
import { getDashboardOverview } from "../dashboard/dashboard.service.js";
import { listTasks } from "../tasks/tasks.service.js";
import { getLatestWorkerLocations } from "../tracking/tracking.socket.js";

const router = Router();

router.use(requireRole(["supervisor"]));

router.get("/dashboard", (req, res) => {
  res.json(getDashboardOverview({ wardId: req.user?.wardId ?? undefined }));
});

router.get("/tasks", (_req, res) => {
  res.json({ items: listTasks() });
});

router.get("/team/live", (_req, res) => {
  res.json({ items: getLatestWorkerLocations() });
});

export const supervisorRouter = router;
