import { Router } from "express";
import { requireRole } from "../../middleware/rbac.js";
import { getAttendanceReportMeta, getDashboardOverview } from "../dashboard/dashboard.service.js";
import { listTasks } from "../tasks/tasks.service.js";

const router = Router();

router.use(requireRole(["admin"]));

router.get("/dashboard", (_req, res) => {
  res.json(getDashboardOverview());
});

router.get("/tasks", (_req, res) => {
  res.json({ items: listTasks() });
});

router.get("/reports", (_req, res) => {
  res.json({
    attendance: getAttendanceReportMeta("pdf"),
    exports: ["pdf", "csv"],
    auditsAvailable: true
  });
});

export const adminRouter = router;
