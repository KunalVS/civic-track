import type { Server } from "socket.io";
import { env } from "../../config/env.js";
import { detectWorkerRouteAnomaly } from "./anomaly.service.js";
import type { TaskRecord } from "../demo/demo.store.js";

interface TrackingPayload {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  batteryLevel?: number;
  capturedAt: string;
}

interface TrackingSnapshot extends TrackingPayload {
  anomalyDetected?: boolean;
  anomalyReasons?: string[];
}

interface WorkerRouteAnomalyState {
  latestPointIsAnomalous: boolean;
  reason: string;
  anomaliesIndices: number[];
}

const latestWorkerLocations = new Map<string, TrackingSnapshot>();
const workerRouteHistory = new Map<string, TrackingPayload[]>();
const workerRouteAnomalies = new Map<string, WorkerRouteAnomalyState>();
const activeWorkerConnections = new Map<string, number>();
let ioServer: Server | null = null;

function keepPreviousHour(route: TrackingPayload[]) {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return route.filter((point) => new Date(point.capturedAt).getTime() >= oneHourAgo);
}

function updateWorkerRoute(payload: TrackingPayload) {
  const currentRoute = workerRouteHistory.get(payload.userId) ?? [];
  const nextRoute = keepPreviousHour([...currentRoute, payload]).sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
  );
  workerRouteHistory.set(payload.userId, nextRoute);
  return nextRoute;
}

export function registerTrackingNamespace(io: Server) {
  ioServer = io;

  io.on("connection", (socket) => {
    socket.on("presence:join", (payload: { userId?: string; role?: string }) => {
      if (payload.userId) {
        socket.join(`user:${payload.userId}`);
        socket.data.userId = payload.userId;
      }

      if (payload.role) {
        socket.join(`role:${payload.role}`);
        socket.data.role = payload.role;
      }

      if (payload.userId && payload.role === "worker") {
        activeWorkerConnections.set(payload.userId, (activeWorkerConnections.get(payload.userId) ?? 0) + 1);
      }
    });

    socket.on("tracking:ping", async (payload: TrackingPayload) => {
      const route = updateWorkerRoute(payload);
      const anomalySummary = await detectWorkerRouteAnomaly({
        workerId: payload.userId,
        route: route.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
          timestamp: point.capturedAt
        }))
      });
      const latestPointIndex = route.length - 1;
      const latestPointIsAnomalous = anomalySummary.anomaliesIndices.includes(latestPointIndex);
      const anomalyReasons = latestPointIsAnomalous
        ? anomalySummary.reason
            .split(".")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      workerRouteAnomalies.set(payload.userId, {
        latestPointIsAnomalous,
        reason: anomalySummary.reason,
        anomaliesIndices: anomalySummary.anomaliesIndices
      });

      latestWorkerLocations.set(payload.userId, {
        ...payload,
        anomalyDetected: latestPointIsAnomalous,
        anomalyReasons
      });

      socket.broadcast.emit("tracking:update", {
        ...payload,
        anomalyDetected: latestPointIsAnomalous,
        anomalyReasons,
        serverReceivedAt: new Date().toISOString()
      });
    });

    socket.emit("tracking:config", {
      recommendedIntervalSeconds: env.TRACKING_MIN_INTERVAL_SECONDS
    });

    socket.on("disconnect", () => {
      const userId = typeof socket.data.userId === "string" ? socket.data.userId : undefined;
      const role = typeof socket.data.role === "string" ? socket.data.role : undefined;

      if (!userId || role !== "worker") {
        return;
      }

      const nextCount = (activeWorkerConnections.get(userId) ?? 1) - 1;

      if (nextCount <= 0) {
        activeWorkerConnections.delete(userId);
        latestWorkerLocations.delete(userId);
        workerRouteHistory.delete(userId);
        workerRouteAnomalies.delete(userId);
        return;
      }

      activeWorkerConnections.set(userId, nextCount);
    });
  });
}

export function getLatestWorkerLocations() {
  return Array.from(latestWorkerLocations.values());
}

export function getWorkerRouteAnomaly(userId: string) {
  return (
    workerRouteAnomalies.get(userId) ?? {
      latestPointIsAnomalous: false,
      reason: "Route is within expected behavior.",
      anomaliesIndices: []
    }
  );
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
