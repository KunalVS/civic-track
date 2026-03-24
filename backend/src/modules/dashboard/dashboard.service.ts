import { demoAttendanceTrend, demoGeofences, demoHeatmap, demoTasks, demoWorkers } from "../demo/demo.data.js";
import { getLatestWorkerLocations } from "../tracking/tracking.socket.js";

export interface DashboardFilters {
  wardId?: string;
  workerId?: string;
}

export function getDashboardOverview(filters: DashboardFilters = {}) {
  const liveLocations = getLatestWorkerLocations();

  const workers = demoWorkers
    .filter((worker) => !filters.wardId || worker.wardId === filters.wardId)
    .filter((worker) => !filters.workerId || worker.id === filters.workerId)
    .map((worker) => {
      const live = liveLocations.find((item) => item.userId === worker.id);

      return live
        ? {
            ...worker,
            latitude: live.latitude,
            longitude: live.longitude,
            status: "moving",
            lastSeenAt: live.capturedAt
          }
        : worker;
    });

  const tasks = demoTasks.filter((task) => !filters.workerId || task.assignedTo === filters.workerId);
  const completedToday = tasks.filter((task) => task.status === "completed").length;
  const activeWorkers = workers.length;

  return {
    kpis: {
      activeWorkers,
      checkedInToday: 94,
      tasksCompletedToday: completedToday,
      slaCompliancePercent: 91.4
    },
    map: {
      workers,
      geofences: demoGeofences
    },
    analytics: {
      attendanceTrend: demoAttendanceTrend,
      productivity: [
        { label: "Average proofs / worker", value: 3.4 },
        { label: "Pending escalations", value: 5 },
        { label: "Low battery trackers", value: 7 }
      ],
      heatmap: demoHeatmap
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
