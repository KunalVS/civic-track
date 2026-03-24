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
    quickActions: string[];
    taskSummary: { assigned: number };
  }>("/worker/dashboard");
}

export async function getWorkerTasks() {
  return requestJson<TaskListResponse>("/worker/tasks");
}

export async function getSupervisorDashboard() {
  return requestJson<DashboardOverview>("/supervisor/dashboard");
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
