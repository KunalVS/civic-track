import type { Server } from "socket.io";
import { env } from "../../config/env.js";
import type { TaskRecord } from "../demo/demo.store.js";

interface TrackingPayload {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  batteryLevel?: number;
  capturedAt: string;
}

const latestWorkerLocations = new Map<string, TrackingPayload>();
let ioServer: Server | null = null;

export function registerTrackingNamespace(io: Server) {
  ioServer = io;

  io.on("connection", (socket) => {
    socket.on("presence:join", (payload: { userId?: string; role?: string }) => {
      if (payload.userId) {
        socket.join(`user:${payload.userId}`);
      }

      if (payload.role) {
        socket.join(`role:${payload.role}`);
      }
    });

    socket.on("tracking:ping", (payload: TrackingPayload) => {
      latestWorkerLocations.set(payload.userId, payload);

      socket.broadcast.emit("tracking:update", {
        ...payload,
        serverReceivedAt: new Date().toISOString()
      });
    });

    socket.emit("tracking:config", {
      recommendedIntervalSeconds: env.TRACKING_MIN_INTERVAL_SECONDS
    });
  });
}

export function getLatestWorkerLocations() {
  return Array.from(latestWorkerLocations.values());
}

export function emitTaskAssigned(task: TaskRecord) {
  if (!ioServer) {
    return;
  }

  ioServer.to(`user:${task.assignedTo}`).emit("task:assigned", {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignedWorkerName: task.assignedWorkerName,
    dueAt: task.dueAt ?? "",
    completedProofs: task.completedProofs,
    expectedPhotoCount: task.expectedPhotoCount,
    beforeImageUrl: task.beforeImageUrl ?? null,
    afterImageUrl: task.afterImageUrl ?? null,
    geofenceId: task.geofenceId ?? null
  });
}

export function emitTaskUpdated(task: TaskRecord) {
  if (!ioServer) {
    return;
  }

  const payload = {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignedWorkerName: task.assignedWorkerName,
    dueAt: task.dueAt ?? "",
    completedProofs: task.completedProofs,
    expectedPhotoCount: task.expectedPhotoCount,
    beforeImageUrl: task.beforeImageUrl ?? null,
    afterImageUrl: task.afterImageUrl ?? null,
    geofenceId: task.geofenceId ?? null
  };

  ioServer.to(`user:${task.assignedTo}`).emit("task:updated", payload);
  ioServer.to("role:supervisor").emit("task:updated", payload);
  ioServer.to("role:admin").emit("task:updated", payload);
}
