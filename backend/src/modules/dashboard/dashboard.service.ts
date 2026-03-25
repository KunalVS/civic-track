import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { completedFieldTasks, users } from "../../db/schema.js";
import { getAttendanceTrend, getHeatmap } from "../demo/demo.store.js";
import { listGeofences } from "../geofences/geofences.service.js";
import { getLatestWorkerLocations } from "../tracking/tracking.socket.js";
import { listTasks } from "../tasks/tasks.service.js";
import { getAttendanceLeaderboard, getSupervisorMapWorkers } from "../workers/worker-directory.service.js";

export interface DashboardFilters {
  wardId?: string;
  workerId?: string;
}

export async function getDashboardOverview(filters: DashboardFilters = {}) {
  const workers = (await getSupervisorMapWorkers({ wardId: filters.wardId })).filter(
    (worker) => !filters.workerId || worker.id === filters.workerId
  );

  const geofences = await listGeofences(filters.wardId);
  const tasks = await listTasks(filters.workerId ? { assignedTo: filters.workerId } : {});
  const completedToday = tasks.filter((task) => task.status === "completed").length;
  const pendingTasks = tasks.filter((task) => task.status !== "completed").length;
  const activeWorkers = workers.length;
  const attendanceLeaderboard = await getAttendanceLeaderboard({ wardId: filters.wardId });
  const recentCompletedRows = await db
    .select({
      id: completedFieldTasks.taskId,
      title: completedFieldTasks.taskName,
      assignedWorkerName: completedFieldTasks.workerName,
      dueAt: completedFieldTasks.completedAt,
      beforeImageUrl: completedFieldTasks.beforeImageUrl,
      afterImageUrl: completedFieldTasks.afterImageUrl
    })
    .from(completedFieldTasks)
    .innerJoin(users, eq(completedFieldTasks.workerId, users.id))
    .where(filters.wardId ? eq(users.wardId, filters.wardId) : undefined)
    .orderBy(desc(completedFieldTasks.completedAt))
    .limit(3);
  const recentCompletedTasks = recentCompletedRows.map((item) => ({
    ...item,
    status: "completed",
    priority: "medium"
  }));
  const taskCompletionMap = new Map<string, number>();

  for (const task of tasks) {
    if (task.status === "completed") {
      taskCompletionMap.set(task.assignedTo, (taskCompletionMap.get(task.assignedTo) ?? 0) + 1);
    }
  }

  return {
    kpis: {
      activeWorkers,
      checkedInToday: 94,
      tasksCompletedToday: completedToday,
      slaCompliancePercent: 91.4
    },
    map: {
      workers,
      geofences,
      tasks
    },
    analytics: {
      attendanceTrend: getAttendanceTrend(),
      attendanceLeaderboard: attendanceLeaderboard.map((item) => ({
        ...item,
        completedTasks: taskCompletionMap.get(item.workerId) ?? 0
      })),
      taskStatusSummary: {
        pending: pendingTasks,
        completed: completedToday,
        inProgress: tasks.filter((task) => task.status === "in_progress").length
      },
      recentCompletedTasks,
      productivity: [
        { label: "Average proofs / worker", value: 3.4 },
        { label: "Pending escalations", value: 5 },
        { label: "Low battery trackers", value: 7 }
      ],
      heatmap: getHeatmap()
    }
  };
}

export function getAttendanceReportMeta(format: "pdf" | "csv") {
  return {
    format,
    queued: false,
    generatedAt: new Date().toISOString(),
    downloadUrl: `/exports/attendance-${new Date().toISOString().slice(0, 10)}.${format}`,
    note: "In production, move report generation to an async worker and signed object storage URLs."
  };
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildAttendancePdfReport(input: {
  title: string;
  generatedAt: string;
  attendanceLeaderboard: Array<{
    rank: number;
    workerName: string;
    daysPresent: number;
    attendanceRate: number;
    completedTasks: number;
  }>;
}) {
  const lines = [
    input.title,
    `Generated at: ${input.generatedAt}`,
    "",
    "Rank | Worker | Present Days | Attendance Rate | Completed Tasks",
    ...input.attendanceLeaderboard.map(
      (item) =>
        `${item.rank} | ${item.workerName} | ${item.daysPresent} | ${item.attendanceRate}% | ${item.completedTasks}`
    )
  ];

  const textCommands = lines
    .map((line, index) => `${index === 0 ? "BT /F1 18 Tf 50 790 Td" : index === 1 ? "T* /F1 11 Tf" : "T*"} (${escapePdfText(line)}) Tj`)
    .join("\n");

  const contentStream = `${textCommands}\nET`;
  const contentLength = Buffer.byteLength(contentStream, "utf8");

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${contentLength} >>
stream
${contentStream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${318 + Buffer.byteLength(String(contentLength), "utf8")}
%%EOF`;

  return Buffer.from(pdf, "utf8");
}
