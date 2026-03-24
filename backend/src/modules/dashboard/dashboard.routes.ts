import { Router } from "express";
import { z } from "zod";
import { buildAttendancePdfReport, getAttendanceReportMeta, getDashboardOverview } from "./dashboard.service.js";

const router = Router();

router.get("/overview", async (req, res, next) => {
  try {
    const query = z
      .object({
        wardId: z.string().optional(),
        workerId: z.string().optional()
      })
      .parse(req.query);

    res.json(await getDashboardOverview(query));
  } catch (error) {
    next(error);
  }
});

router.get("/reports/attendance", async (req, res, next) => {
  try {
    const query = z
      .object({
        format: z.enum(["pdf", "csv"]).default("pdf"),
        wardId: z.string().optional()
      })
      .parse(req.query);

    if (query.format === "pdf") {
      const overview = await getDashboardOverview({ wardId: query.wardId });
      const pdf = buildAttendancePdfReport({
        title: "CivicTrack Attendance Analytics Report",
        generatedAt: new Date().toISOString(),
        attendanceLeaderboard: overview.analytics.attendanceLeaderboard
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="attendance-analytics-report.pdf"');
      res.send(pdf);
      return;
    }

    res.json(getAttendanceReportMeta(query.format));
  } catch (error) {
    next(error);
  }
});

export const dashboardRouter = router;
