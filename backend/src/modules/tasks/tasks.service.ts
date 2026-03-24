import { randomUUID } from "node:crypto";
import type { Role } from "@civictrack/shared";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { completedFieldTasks, users } from "../../db/schema.js";
import { createZoneTask, getTasks, getWorkers, recordTaskProof } from "../demo/demo.store.js";
import { getWorkerDirectory } from "../workers/worker-directory.service.js";

export interface TaskFilters {
  status?: string;
  assignedTo?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedTo: string;
  geofenceId: string;
  dueAt?: string;
  priority?: string;
  expectedPhotoCount?: number;
}

export interface UploadProofInput {
  imageUrl: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
  stage: "before" | "after";
  metadata?: Record<string, unknown>;
}

export function listTasks(filters: TaskFilters = {}) {
  return getTasks().filter((task) => {
    if (filters.status && task.status !== filters.status) {
      return false;
    }

    if (filters.assignedTo && task.assignedTo !== filters.assignedTo) {
      return false;
    }

    return true;
  });
}

export async function createTask(input: CreateTaskInput, assignedByRole: Role) {
  const [assignedWorker] = await db
    .select({
      id: users.id,
      name: users.fullName
    })
    .from(users)
    .where(eq(users.id, input.assignedTo))
    .limit(1);

  const createdTask = createZoneTask({
    ...input,
    priority: input.priority ?? (assignedByRole === "admin" ? "high" : "medium")
  });

  if (assignedWorker) {
    createdTask.assignedWorkerName = assignedWorker.name;
  }

  return createdTask;
}

export async function buildTaskProof(taskId: string, uploadedBy: string, input: UploadProofInput) {
  const updatedTask = recordTaskProof(taskId, input.stage, input.imageUrl);

  if (updatedTask?.status === "completed" && updatedTask.beforeImageUrl && updatedTask.afterImageUrl) {
    await db
      .insert(completedFieldTasks)
      .values({
        taskId,
        workerId: updatedTask.assignedTo,
        workerName: updatedTask.assignedWorkerName,
        taskName: updatedTask.title,
        beforeImageUrl: updatedTask.beforeImageUrl,
        afterImageUrl: updatedTask.afterImageUrl,
        completedAt: new Date()
      })
      .onConflictDoUpdate({
        target: completedFieldTasks.taskId,
        set: {
          workerId: updatedTask.assignedTo,
          workerName: updatedTask.assignedWorkerName,
          taskName: updatedTask.title,
          beforeImageUrl: updatedTask.beforeImageUrl,
          afterImageUrl: updatedTask.afterImageUrl,
          completedAt: new Date()
        }
      });
  }

  return {
    id: randomUUID(),
    taskId,
    uploadedBy,
    taskStatus: updatedTask?.status ?? "in_progress",
    updatedTask,
    ...input
  };
}

export async function listAssignableWorkers(wardId?: string) {
  const directory = await getWorkerDirectory({ wardId });

  return directory.map((worker) => ({
    id: worker.id,
    name: worker.name,
    status: getWorkers().find((item) => item.id === worker.id)?.status ?? "idle",
    wardId: worker.wardId ?? ""
  }));
}
