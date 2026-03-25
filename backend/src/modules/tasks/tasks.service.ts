import { randomUUID } from "node:crypto";
import type { Role } from "@civictrack/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { completedFieldTasks, taskProofs, tasks, users } from "../../db/schema.js";
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

async function hydrateTasks(taskRows: Array<{
  id: string;
  title: string;
  description: string | null;
  status: "assigned" | "in_progress" | "completed" | "rejected";
  priority: "low" | "medium" | "high" | "critical";
  geofenceId: string | null;
  assignedTo: string | null;
  assignedWorkerName: string | null;
  dueAt: Date | null;
  expectedPhotoCount: number;
  completedAt: Date | null;
}>) {
  if (taskRows.length === 0) {
    return [];
  }

  const proofs = await db
    .select({
      taskId: taskProofs.taskId,
      imageUrl: taskProofs.imageUrl,
      metadata: taskProofs.metadata,
      createdAt: taskProofs.createdAt
    })
    .from(taskProofs)
    .where(inArray(taskProofs.taskId, taskRows.map((task) => task.id)))
    .orderBy(desc(taskProofs.createdAt));

  const proofByTaskId = new Map<string, { beforeImageUrl: string | null; afterImageUrl: string | null; completedProofs: number }>();

  for (const proof of proofs) {
    const existing = proofByTaskId.get(proof.taskId) ?? {
      beforeImageUrl: null,
      afterImageUrl: null,
      completedProofs: 0
    };

    const stage = typeof proof.metadata === "object" && proof.metadata && "stage" in proof.metadata ? String(proof.metadata.stage) : "";

    if (stage === "before" && !existing.beforeImageUrl) {
      existing.beforeImageUrl = proof.imageUrl;
    }

    if (stage === "after" && !existing.afterImageUrl) {
      existing.afterImageUrl = proof.imageUrl;
    }

    existing.completedProofs = [existing.beforeImageUrl, existing.afterImageUrl].filter(Boolean).length;
    proofByTaskId.set(proof.taskId, existing);
  }

  return taskRows.map((task) => {
    const proofState = proofByTaskId.get(task.id) ?? {
      beforeImageUrl: null,
      afterImageUrl: null,
      completedProofs: 0
    };

    return {
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      geofenceId: task.geofenceId,
      assignedTo: task.assignedTo ?? "",
      assignedWorkerName: task.assignedWorkerName ?? "Unassigned",
      dueAt: task.dueAt?.toISOString() ?? "",
      completedProofs: proofState.completedProofs,
      expectedPhotoCount: task.expectedPhotoCount,
      beforeImageUrl: proofState.beforeImageUrl,
      afterImageUrl: proofState.afterImageUrl
    };
  });
}

export async function listTasks(filters: TaskFilters = {}) {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status as "assigned" | "in_progress" | "completed" | "rejected"));
  }

  if (filters.assignedTo) {
    conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  }

  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      geofenceId: tasks.geofenceId,
      assignedTo: tasks.assignedTo,
      assignedWorkerName: users.fullName,
      dueAt: tasks.dueAt,
      expectedPhotoCount: tasks.expectedPhotoCount,
      completedAt: tasks.completedAt
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.createdAt));

  return hydrateTasks(taskRows);
}

export async function createTask(input: CreateTaskInput, assignedByRole: Role, assignedByUserId?: string) {
  const [assignedWorker] = await db
    .select({
      id: users.id,
      name: users.fullName,
      wardId: users.wardId
    })
    .from(users)
    .where(eq(users.id, input.assignedTo))
    .limit(1);

  const [createdTask] = await db
    .insert(tasks)
    .values({
      title: input.title,
      description: input.description ?? "",
      wardId: assignedWorker?.wardId ?? null,
      geofenceId: input.geofenceId,
      assignedTo: input.assignedTo,
      assignedBy: assignedByUserId ?? null,
      status: "assigned",
      priority: (input.priority ?? (assignedByRole === "admin" ? "high" : "medium")) as
        | "low"
        | "medium"
        | "high"
        | "critical",
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      expectedPhotoCount: Math.max(input.expectedPhotoCount ?? 2, 1)
    })
    .returning({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      geofenceId: tasks.geofenceId,
      assignedTo: tasks.assignedTo,
      dueAt: tasks.dueAt,
      expectedPhotoCount: tasks.expectedPhotoCount,
      completedAt: tasks.completedAt
    });

  const hydrated = await hydrateTasks([
    {
      ...createdTask,
      assignedWorkerName: assignedWorker?.name ?? "Unknown Worker"
    }
  ]);

  return hydrated[0];
}

export async function buildTaskProof(taskId: string, uploadedBy: string, input: UploadProofInput) {
  await db.insert(taskProofs).values({
    taskId,
    uploadedBy,
    imageUrl: input.imageUrl,
    latitude: input.latitude,
    longitude: input.longitude,
    capturedAt: new Date(input.capturedAt),
    metadata: {
      ...(input.metadata ?? {}),
      stage: input.stage
    }
  });

  const proofs = await db
    .select({
      id: taskProofs.id,
      imageUrl: taskProofs.imageUrl,
      metadata: taskProofs.metadata
    })
    .from(taskProofs)
    .where(eq(taskProofs.taskId, taskId))
    .orderBy(desc(taskProofs.createdAt));

  const hasBefore = proofs.some((proof) => typeof proof.metadata === "object" && proof.metadata && "stage" in proof.metadata && proof.metadata.stage === "before");
  const hasAfter = proofs.some((proof) => typeof proof.metadata === "object" && proof.metadata && "stage" in proof.metadata && proof.metadata.stage === "after");

  const nextStatus = hasBefore && hasAfter ? "completed" : hasBefore || hasAfter ? "in_progress" : "assigned";

  await db
    .update(tasks)
    .set({
      status: nextStatus,
      completedAt: nextStatus === "completed" ? new Date() : null
    })
    .where(eq(tasks.id, taskId));

  const [updatedTask] = await listTasks({}).then((items) => items.filter((task) => task.id === taskId));

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
    status: "idle",
    wardId: worker.wardId ?? ""
  }));
}
