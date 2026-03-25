import { io } from "socket.io-client";

interface RoutePoint {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

const socket = io("http://127.0.0.1:4000", {
  path: "/socket.io",
  transports: ["websocket"]
});

function isoMinutesAgo(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function buildNormalRoute(startLat: number, startLng: number): RoutePoint[] {
  return Array.from({ length: 12 }, (_, index) => ({
    latitude: startLat + index * 0.0002,
    longitude: startLng + index * 0.00015,
    capturedAt: isoMinutesAgo((11 - index) * 5)
  }));
}

function buildIdleThenDetourRoute(startLat: number, startLng: number): RoutePoint[] {
  const route = Array.from({ length: 8 }, (_, index) => ({
    latitude: startLat + index * 0.00006,
    longitude: startLng + index * 0.00004,
    capturedAt: isoMinutesAgo((11 - index) * 5)
  }));

  route.push(
    {
      latitude: startLat + 0.0004,
      longitude: startLng + 0.00035,
      capturedAt: isoMinutesAgo(35)
    },
    {
      latitude: startLat + 0.0004,
      longitude: startLng + 0.00035,
      capturedAt: isoMinutesAgo(30)
    },
    {
      latitude: startLat + 0.0004,
      longitude: startLng + 0.00035,
      capturedAt: isoMinutesAgo(25)
    },
     {
      latitude: startLat + 0.0004,
      longitude: startLng + 0.00036,
      capturedAt: isoMinutesAgo(20)
    },
     {
      latitude: startLat + 0.0004,
      longitude: startLng + 0.00035,
      capturedAt: isoMinutesAgo(15)
    },
    {
      latitude: startLat + 0.023,
      longitude: startLng + 0.028,
      capturedAt: isoMinutesAgo(10)
    }
  );

  return route;
}

const workers = [
  {
    userId: "00000000-0000-0000-0000-000000000001",
    route: buildNormalRoute(15.9043, 73.8217)
  },
  {
    userId: "00000000-0000-0000-0000-000000000004",
    route: buildIdleThenDetourRoute(15.9071, 73.8192)
  }
];

socket.on("connect", () => {
  console.log("Simulator connected. Emitting synthetic worker routes...");

  let offset = 0;
  for (const worker of workers) {
    for (const point of worker.route) {
      setTimeout(() => {
        socket.emit("tracking:ping", {
          userId: worker.userId,
          latitude: point.latitude,
          longitude: point.longitude,
          capturedAt: point.capturedAt
        });
      }, offset);
      offset += 300;
    }
  }

  setTimeout(() => {
    console.log("Simulation complete.");
    socket.close();
  }, offset + 1000);
});

socket.on("connect_error", (error) => {
  console.error("Simulator failed to connect:", error.message);
  process.exitCode = 1;
});
