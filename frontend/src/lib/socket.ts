import { io } from "socket.io-client";

const socketBaseUrl =
  (import.meta.env.VITE_SOCKET_URL as string | undefined)?.replace(/\/$/, "") ?? window.location.origin;

export const socket = io(socketBaseUrl, {
  autoConnect: false,
  path: "/socket.io"
});
