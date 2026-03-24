import { randomUUID } from "node:crypto";
import { demoAttendanceTrend, demoGeofences, demoHeatmap, demoTasks, demoWorkers } from "./demo.data.js";

export interface WorkerRecord {
  id: string;
  name: string;
  role: string;
  latitude: number;
  longitude: number;
  status: string;
  wardId: string;
  lastSeenAt: string;
}

export interface GeofenceRecord {
  id: string;
  name: string;
  wardId: string;
  center: [number, number];
  radiusMeters: number;
  type: "radius";
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  geofenceId: string | null;
  assignedTo: string;
  assignedWorkerName: string;
  dueAt: string | null;
  completedProofs: number;
  expectedPhotoCount: number;
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
}

export interface AttendanceRankRecord {
  workerId: string;
  workerName: string;
  daysPresent: number;
  attendanceRate: number;
  completedTasks: number;
  rank: number;
}

const taskStore: TaskRecord[] = demoTasks.map((task) => ({ ...task }));
const geofenceStore: GeofenceRecord[] = demoGeofences.map((geofence) => ({ ...geofence }));
const workerStore: WorkerRecord[] = demoWorkers.map((worker) => ({ ...worker }));
const attendanceTrendStore = demoAttendanceTrend.map((item) => ({ ...item }));
const heatmapStore = demoHeatmap.map((item) => ({ ...item }));

let attendanceRankStore: AttendanceRankRecord[] = [
  {
    workerId: "00000000-0000-0000-0000-000000000001",
    workerName: "Demo Worker",
    daysPresent: 24,
    attendanceRate: 96,
    completedTasks: 18,
    rank: 1
  },
  {
    workerId: "00000000-0000-0000-0000-000000000004",
    workerName: "Line Crew 14",
    daysPresent: 21,
    attendanceRate: 84,
    completedTasks: 12,
    rank: 2
  }
];

function recomputeRanks() {
  attendanceRankStore = attendanceRankStore
    .slice()
    .sort((a, b) => {
      if (b.attendanceRate !== a.attendanceRate) {
        return b.attendanceRate - a.attendanceRate;
      }

      return b.completedTasks - a.completedTasks;
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
}

export function getWorkers() {
  return workerStore.slice();
}

export function getGeofences() {
  return geofenceStore.slice();
}

export function getTasks() {
  return taskStore.slice();
}

export function getAttendanceTrend() {
  return attendanceTrendStore.slice();
}

export function getHeatmap() {
  return heatmapStore.slice();
}

export function getAttendanceLeaderboard() {
  return attendanceRankStore.slice();
}

export function createZoneTask(input: {
  title: string;
  description?: string;
  assignedTo: string;
  geofenceId: string;
  dueAt?: string;
  priority?: string;
  expectedPhotoCount?: number;
}) {
  const worker = workerStore.find((item) => item.id === input.assignedTo);
  const createdTask: TaskRecord = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? "",
    status: "assigned",
    priority: input.priority ?? "medium",
    geofenceId: input.geofenceId,
    assignedTo: input.assignedTo,
    assignedWorkerName: worker?.name ?? "Unknown Worker",
    dueAt: input.dueAt ?? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    completedProofs: 0,
    expectedPhotoCount: Math.max(input.expectedPhotoCount ?? 2, 1),
    beforeImageUrl: null,
    afterImageUrl: null
  };

  taskStore.unshift(createdTask);
  return createdTask;
}

export function updateTaskStatus(taskId: string, status: string) {
  const task = taskStore.find((item) => item.id === taskId);
  if (!task) {
    return null;
  }

  task.status = status;
  return task;
}

export function recordTaskProof(taskId: string, stage: "before" | "after", imageUrl: string) {
  const task = taskStore.find((item) => item.id === taskId);
  if (!task) {
    return null;
  }

  if (stage === "before") {
    task.beforeImageUrl = imageUrl;
  } else {
    task.afterImageUrl = imageUrl;
  }

  task.completedProofs = [task.beforeImageUrl, task.afterImageUrl].filter(Boolean).length;
  if (task.beforeImageUrl && task.afterImageUrl) {
    task.status = "completed";
  } else if (task.beforeImageUrl || task.afterImageUrl) {
    task.status = "in_progress";
  } else {
    task.status = "assigned";
  }

  const attendanceRecord = attendanceRankStore.find((item) => item.workerId === task.assignedTo);
  if (attendanceRecord && task.status === "completed") {
    attendanceRecord.completedTasks += 1;
    recomputeRanks();
  }

  return task;
}
