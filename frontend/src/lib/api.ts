const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

export type Role = "worker" | "supervisor" | "admin";

export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: Role;
  wardId?: string | null;
}

export interface DashboardOverview {
  kpis: {
    activeWorkers: number;
    checkedInToday: number;
    tasksCompletedToday: number;
    slaCompliancePercent: number;
  };
  map: {
    workers: Array<{
      id: string;
      name: string;
      role: string;
      latitude: number;
      longitude: number;
      status: string;
      lastSeenAt: string;
      wardId?: string;
    }>;
    geofences: Array<{
      id: string;
      name: string;
      center: [number, number];
      radiusMeters: number;
      wardId?: string;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      geofenceId: string | null;
      assignedWorkerName: string;
    }>;
  };
  analytics: {
    attendanceTrend: Array<{
      date: string;
      present: number;
      absent: number;
    }>;
    productivity: Array<{
      label: string;
      value: number;
    }>;
    attendanceLeaderboard: Array<{
      workerId: string;
      workerName: string;
      daysPresent: number;
      attendanceRate: number;
      completedTasks: number;
      rank: number;
    }>;
    taskStatusSummary: {
      pending: number;
      completed: number;
      inProgress: number;
    };
    recentCompletedTasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      assignedWorkerName: string;
      dueAt: string;
      beforeImageUrl?: string | null;
      afterImageUrl?: string | null;
    }>;
    heatmap: Array<{
      latitude: number;
      longitude: number;
      weight: number;
    }>;
  };
}

export interface TaskListResponse {
  items: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignedWorkerName: string;
    dueAt: string;
    completedProofs: number;
    expectedPhotoCount: number;
    beforeImageUrl?: string | null;
    afterImageUrl?: string | null;
  }>;
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const { token, headers, ...rest } = options;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token !== undefined || localStorage.getItem("civictrack_token")
          ? {
              Authorization: `Bearer ${token ?? localStorage.getItem("civictrack_token") ?? ""}`
            }
          : {}),
        ...headers
      }
    });
  } catch {
    throw new Error("Unable to reach backend. Start the backend server and confirm the frontend proxy or API base URL is configured.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Failed to fetch ${path}`);
  }

  return (await response.json()) as T;
}

export async function getDashboardOverview() {
  return requestJson<DashboardOverview>("/dashboard/overview");
}

export async function getTasks() {
  return requestJson<TaskListResponse>("/tasks");
}

export async function signup(payload: {
  fullName: string;
  phone: string;
  role: Exclude<Role, "admin">;
  aadhaarNumber: string;
  wardId?: string | null;
  email: string;
  password: string;
}) {
  return requestJson<{ success: boolean; user: AuthUser; message: string }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function login(payload: { email: string; password: string }) {
  return requestJson<{ user: AuthUser; accessToken: string; sessionId: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function logout() {
  return requestJson<{ success: boolean }>("/auth/logout", {
    method: "POST"
  });
}

export async function getCurrentUser(token?: string) {
  return requestJson<{ user: AuthUser }>("/auth/me", { token });
}

export async function getWorkerDashboard() {
  return requestJson<{
    user: AuthUser;
    attendance: {
      checkedInToday: boolean;
      presentDaysThisMonth: number;
    };
    status: "active" | "idle";
    taskSummary: { assigned: number };
  }>("/worker/dashboard");
}

export async function getWorkerTasks() {
  return requestJson<TaskListResponse>("/worker/tasks");
}

export async function getSupervisorDashboard() {
  return requestJson<DashboardOverview>("/supervisor/dashboard");
}

export async function getSupervisorResources() {
  return requestJson<{
    workers: Array<{
      id: string;
      name: string;
      status: string;
      wardId: string;
    }>;
    geofences: Array<{
      id: string;
      name: string;
      wardId: string;
      center: [number, number];
      radiusMeters: number;
      type: "radius";
    }>;
  }>("/supervisor/resources");
}

export async function createSupervisorTask(payload: {
  title: string;
  description?: string;
  geofenceId: string;
  assignedTo: string;
  dueAt?: string;
  priority?: "low" | "medium" | "high" | "critical";
}) {
  return requestJson<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignedWorkerName: string;
    dueAt: string;
    completedProofs: number;
    expectedPhotoCount: number;
    beforeImageUrl?: string | null;
    afterImageUrl?: string | null;
    geofenceId: string | null;
  }>("/supervisor/tasks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function uploadTaskProof(
  taskId: string,
  payload: {
    imageUrl: string;
    latitude: number;
    longitude: number;
    capturedAt: string;
    stage: "before" | "after";
    metadata?: Record<string, unknown>;
  }
) {
  return requestJson<{
    id: string;
    taskId: string;
    taskStatus: string;
    stage: "before" | "after";
    updatedTask?: TaskListResponse["items"][number];
  }>(`/tasks/${taskId}/proofs`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function downloadSupervisorAttendancePdf(wardId?: string | null) {
  const token = localStorage.getItem("civictrack_token") ?? "";
  const url = new URL(`${window.location.origin}${API_BASE_URL}/dashboard/reports/attendance`);

  url.searchParams.set("format", "pdf");
  if (wardId) {
    url.searchParams.set("wardId", wardId);
  }

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }).then(async (response) => {
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? "Failed to download attendance report");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "attendance-analytics-report.pdf";
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  });
}

export async function getSupervisorLiveTeam() {
  return requestJson<{ items: Array<{ userId: string; latitude: number; longitude: number; capturedAt: string }> }>(
    "/supervisor/team/live"
  );
}

export async function getAdminDashboard() {
  return requestJson<DashboardOverview>("/admin/dashboard");
}

export async function getAdminReports() {
  return requestJson<{
    attendance: { format: string; generatedAt: string; downloadUrl: string };
    exports: string[];
    auditsAvailable: boolean;
  }>("/admin/reports");
}
