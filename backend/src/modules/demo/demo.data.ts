export const demoWards = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Ward 12",
    code: "WARD-12"
  }
] as const;

export const demoGeofences = [
  {
    id: "gf_ward12_depot",
    name: "Ward 12 Depot",
    wardId: demoWards[0].id,
    center: [28.6142, 77.2089] as [number, number],
    radiusMeters: 250,
    type: "radius" as const
  },
  {
    id: "gf_drainage_zone",
    name: "Drainage Inspection Corridor",
    wardId: demoWards[0].id,
    center: [28.6116, 77.2145] as [number, number],
    radiusMeters: 420,
    type: "radius" as const
  }
];

export const demoWorkers = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Demo Worker",
    role: "worker",
    latitude: 28.6139,
    longitude: 77.209,
    status: "moving",
    wardId: demoWards[0].id,
    lastSeenAt: new Date().toISOString()
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "Line Crew 14",
    role: "worker",
    latitude: 28.6178,
    longitude: 77.2068,
    status: "idle",
    wardId: demoWards[0].id,
    lastSeenAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
  }
];

export const demoTasks = [
  {
    id: "task_1",
    title: "Drainage inspection",
    description: "Inspect blocked drains in the central corridor and upload geo-tagged proof.",
    status: "in_progress",
    priority: "high",
    geofenceId: "gf_drainage_zone",
    assignedTo: "00000000-0000-0000-0000-000000000001",
    assignedWorkerName: "Demo Worker",
    dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    completedProofs: 1,
    expectedPhotoCount: 2
  },
  {
    id: "task_2",
    title: "Streetlight audit",
    description: "Audit streetlights near the depot and mark faulty poles.",
    status: "assigned",
    priority: "medium",
    geofenceId: "gf_ward12_depot",
    assignedTo: "00000000-0000-0000-0000-000000000004",
    assignedWorkerName: "Line Crew 14",
    dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    completedProofs: 0,
    expectedPhotoCount: 1
  }
];

export const demoAttendanceTrend = [
  { date: "2026-03-20", present: 88, absent: 12 },
  { date: "2026-03-21", present: 91, absent: 9 },
  { date: "2026-03-22", present: 93, absent: 7 },
  { date: "2026-03-23", present: 95, absent: 5 },
  { date: "2026-03-24", present: 94, absent: 6 }
];

export const demoHeatmap = [
  { latitude: 28.6134, longitude: 77.2104, weight: 0.93 },
  { latitude: 28.6148, longitude: 77.2081, weight: 0.74 },
  { latitude: 28.6117, longitude: 77.2142, weight: 0.88 }
];
