import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { attendanceRouter } from "../modules/attendance/attendance.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter, mockEkycRouter } from "../modules/auth/auth.routes.js";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { supervisorRouter } from "../modules/supervisor/supervisor.routes.js";
import { tasksRouter } from "../modules/tasks/tasks.routes.js";
import { getLatestWorkerLocations } from "../modules/tracking/tracking.socket.js";
import { workerRouter } from "../modules/worker/worker.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "civictrack-backend",
    timestamp: new Date().toISOString()
  });
});

router.use("/auth", authRouter);
router.use("/mock-ekyc", mockEkycRouter);
router.use("/attendance", requireAuth, requireRole(["worker", "supervisor", "admin"]), attendanceRouter);
router.use("/tasks", requireAuth, requireRole(["worker", "supervisor", "admin"]), tasksRouter);
router.use("/dashboard", requireAuth, requireRole(["supervisor", "admin"]), dashboardRouter);
router.use("/worker", requireAuth, workerRouter);
router.use("/supervisor", requireAuth, supervisorRouter);
router.use("/admin", requireAuth, adminRouter);
router.get("/tracking/live", requireAuth, requireRole(["supervisor", "admin"]), (_req, res) => {
  res.json({ items: getLatestWorkerLocations() });
});

export const apiRouter = router;
