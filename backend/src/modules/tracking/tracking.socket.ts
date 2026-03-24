import type { Server } from "socket.io";
import { env } from "../../config/env.js";

interface TrackingPayload {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  batteryLevel?: number;
  capturedAt: string;
}

const latestWorkerLocations = new Map<string, TrackingPayload>();

export function registerTrackingNamespace(io: Server) {
  io.on("connection", (socket) => {
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
