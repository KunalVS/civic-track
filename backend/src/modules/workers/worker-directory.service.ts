import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { attendanceLogs, users, workers } from "../../db/schema.js";
import { getLatestWorkerLocations, getWorkerRouteAnomaly } from "../tracking/tracking.socket.js";

interface WorkerDirectoryFilters {
  wardId?: string;
}

const wardFallbackCenter: Record<string, [number, number]> = {
  "11111111-1111-1111-1111-111111111111": [15.9043, 73.8217]
};

function buildFallbackCoordinates(wardId: string | null | undefined, index: number): [number, number] {
  const [baseLat, baseLng] = wardFallbackCenter[wardId ?? ""] ?? [15.9043, 73.8217];
  return [baseLat + index * 0.0016, baseLng + index * 0.0011];
}

export async function getWorkerDirectory(filters: WorkerDirectoryFilters = {}) {
  return db
    .select({
      id: users.id,
      name: users.fullName,
      email: users.email,
      phone: users.phone,
      wardId: users.wardId,
      employeeCode: workers.employeeCode,
      department: workers.department
    })
    .from(workers)
    .innerJoin(users, eq(workers.userId, users.id))
    .where(
      and(eq(users.role, "worker"), eq(users.isActive, true), filters.wardId ? eq(users.wardId, filters.wardId) : undefined)
    )
    .orderBy(desc(workers.createdAt));
}

export async function getSupervisorMapWorkers(filters: WorkerDirectoryFilters = {}) {
  const directory = await getWorkerDirectory(filters);
  const liveLocations = getLatestWorkerLocations();

  return directory.map((worker, index) => {
    const live = liveLocations.find((item) => item.userId === worker.id);
    const anomaly = getWorkerRouteAnomaly(worker.id);
    const [fallbackLat, fallbackLng] = buildFallbackCoordinates(worker.wardId, index);

    return {
      id: worker.id,
      name: worker.name,
      role: "worker",
      latitude: live?.latitude ?? fallbackLat,
      longitude: live?.longitude ?? fallbackLng,
      status: live ? "moving" : "idle",
      anomalyDetected: anomaly.latestPointIsAnomalous,
      anomalyReasons: anomaly.latestPointIsAnomalous
        ? anomaly.reason
            .split(".")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      wardId: worker.wardId ?? undefined,
      lastSeenAt: live?.capturedAt ?? new Date(Date.now() - index * 5 * 60 * 1000).toISOString()
    };
  });
}

export async function getAttendanceLeaderboard(filters: WorkerDirectoryFilters = {}) {
  const directory = await getWorkerDirectory(filters);
  const attendanceCounts = await db
    .select({
      userId: attendanceLogs.userId,
      daysPresent: sql<number>`count(*) filter (where ${attendanceLogs.type} = 'check_in')`
    })
    .from(attendanceLogs)
    .groupBy(attendanceLogs.userId);

  const countMap = new Map(attendanceCounts.map((item) => [item.userId, Number(item.daysPresent ?? 0)]));

  return directory
    .map((worker) => {
      const daysPresent = countMap.get(worker.id) ?? 0;
      const attendanceRate = Math.min(100, Math.round((daysPresent / 25) * 100));

      return {
        workerId: worker.id,
        workerName: worker.name,
        daysPresent,
        attendanceRate,
        completedTasks: 0,
        rank: 0
      };
    })
    .sort((a, b) => {
      if (b.attendanceRate !== a.attendanceRate) {
        return b.attendanceRate - a.attendanceRate;
      }

      return b.daysPresent - a.daysPresent;
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
}
