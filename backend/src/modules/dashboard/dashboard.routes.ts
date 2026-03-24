import { Router } from "express";
import { z } from "zod";
import { getAttendanceReportMeta, getDashboardOverview } from "./dashboard.service.js";

const router = Router();

router.get("/overview", (req, res) => {
  const query = z
    .object({
      wardId: z.string().optional(),
      workerId: z.string().optional()
    })
    .parse(req.query);

  res.json(getDashboardOverview(query));
});

router.get("/reports/attendance", (req, res, next) => {
  try {
    const query = z
      .object({
        format: z.enum(["pdf", "csv"]).default("pdf")
      })
      .parse(req.query);

    res.json(getAttendanceReportMeta(query.format));
  } catch (error) {
    next(error);
  }
});

export const dashboardRouter = router;
