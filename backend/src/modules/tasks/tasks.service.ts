import { randomUUID } from "node:crypto";
import type { Role } from "@civictrack/shared";
import { demoTasks, demoWorkers } from "../demo/demo.data.js";

export interface TaskFilters {
  status?: string;
  assignedTo?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedTo: string;
  geofenceId?: string;
  dueAt?: string;
}

export interface UploadProofInput {
  imageUrl: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
  metadata?: Record<string, unknown>;
}

export function listTasks(filters: TaskFilters = {}) {
  return demoTasks.filter((task) => {
    if (filters.status && task.status !== filters.status) {
      return false;
    }

    if (filters.assignedTo && task.assignedTo !== filters.assignedTo) {
      return false;
    }

    return true;
  });
}

export function createTask(input: CreateTaskInput, assignedByRole: Role) {
  const assignedWorker = demoWorkers.find((worker) => worker.id === input.assignedTo);

  return {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? "",
    assignedTo: input.assignedTo,
    assignedWorkerName: assignedWorker?.name ?? "Unknown Worker",
    geofenceId: input.geofenceId ?? null,
    dueAt: input.dueAt ?? null,
    priority: assignedByRole === "admin" ? "high" : "medium",
    status: "assigned",
    completedProofs: 0,
    expectedPhotoCount: 1
  };
}

export function buildTaskProof(taskId: string, uploadedBy: string, input: UploadProofInput) {
  return {
    id: randomUUID(),
    taskId,
    uploadedBy,
    ...input
  };
}
