import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { registerTrackingNamespace } from "./modules/tracking/tracking.socket.js";

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.ALLOWED_ORIGIN
  },
  pingInterval: env.SOCKET_PING_INTERVAL_MS
});

registerTrackingNamespace(io);

server.listen(env.PORT, () => {
  console.log(`CivicTrack backend listening on port ${env.PORT}`);
});
