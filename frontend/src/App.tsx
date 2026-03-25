import { type ReactNode, useEffect, useState } from "react";
import { AttendanceLeaderboard } from "./components/AttendanceLeaderboard";
import { KpiCards } from "./components/KpiCards";
import { MapPanel } from "./components/MapPanel";
import { SupervisorTaskComposer } from "./components/SupervisorTaskComposer";
import { TaskKanbanBoard } from "./components/TaskKanbanBoard";
import { TaskTable } from "./components/TaskTable";
import { AttendanceTrendChart, ProductivityBars } from "./components/TrendCharts";
import {
  autoMarkWorkerLoginAttendance,
  type AuthUser,
  type DashboardOverview,
  type Role,
  getAdminDashboard,
  getAdminReports,
  getCurrentUser,
  getSupervisorDashboard,
  getSupervisorResources,
  getTasks,
  getWorkerDashboard,
  getWorkerTasks,
  login,
  logout,
  signup,
  createSupervisorTask,
  uploadTaskProof
} from "./lib/api";
import { socket } from "./lib/socket";

type RoutePath = "/login" | "/signup" | "/worker" | "/supervisor" | "/admin";
type PublicRoutePath = "/" | RoutePath;

interface TrackingUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
  anomalyDetected?: boolean;
  anomalyReasons?: string[];
}

interface TrackingOfflineUpdate {
  userId: string;
}

interface TaskAssignedUpdate {
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
  geofenceId?: string | null;
}

interface TaskItem {
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
  geofenceId?: string | null;
}

const wardId = "11111111-1111-1111-1111-111111111111";
const workerOfflineSnapshotKey = "civictrack_worker_offline_snapshot";

const fallbackDashboard: DashboardOverview = {
  kpis: {
    activeWorkers: 0,
    checkedInToday: 0,
    tasksCompletedToday: 0,
    slaCompliancePercent: 0
  },
  map: {
    workers: [],
    geofences: [],
    tasks: []
  },
  analytics: {
    attendanceTrend: [],
    productivity: [],
    attendanceLeaderboard: [],
    taskStatusSummary: {
      pending: 0,
      completed: 0,
      inProgress: 0
    },
    recentCompletedTasks: [],
    heatmap: []
  }
};

const fallbackTasks: TaskItem[] = [];

interface WorkerOfflineSnapshot {
  workerId: string;
  workerName: string;
  assignedTasks: TaskItem[];
  summary: {
    attendance: {
      checkedInToday: boolean;
      presentDaysThisMonth: number;
    };
    status: "active" | "idle";
    taskSummary: { assigned: number };
  };
  location: {
    latitude: number;
    longitude: number;
    capturedAt: string;
  } | null;
  updatedAt: string;
}

function getInitialRoute(): PublicRoutePath {
  const path = window.location.pathname as PublicRoutePath;
  return ["/", "/login", "/signup", "/worker", "/supervisor", "/admin"].includes(path) ? path : "/";
}

function routeForRole(role: Role): RoutePath {
  if (role === "worker") {
    return "/worker";
  }

  if (role === "supervisor") {
    return "/supervisor";
  }

  return "/admin";
}

function navigate(path: PublicRoutePath) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function readCachedUser() {
  const raw = localStorage.getItem("civictrack_user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem("civictrack_user");
    return null;
  }
}

function readWorkerOfflineSnapshot() {
  const raw = localStorage.getItem(workerOfflineSnapshotKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as WorkerOfflineSnapshot;
  } catch {
    localStorage.removeItem(workerOfflineSnapshotKey);
    return null;
  }
}

function writeWorkerOfflineSnapshot(snapshot: WorkerOfflineSnapshot) {
  localStorage.setItem(workerOfflineSnapshotKey, JSON.stringify(snapshot));
}

function AuthCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="auth-card panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
      {children}
    </section>
  );
}

function HomeView() {
  return (
    <main className="home-shell">
      <section className="home-hero panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Municipal Workforce Intelligence</p>
          <h1>CivicTrack</h1>
          <p className="home-lead">
            GPS-based attendance, live field tracking, supervisor task assignment, geo-tagged work proof, and analytics for
            municipal operations teams.
          </p>
          <div className="home-actions">
            <button type="button" onClick={() => navigate("/login")}>
              Login
            </button>
            <button type="button" className="secondary-button" onClick={() => navigate("/signup")}>
              Sign up
            </button>
          </div>
        </div>
        <div className="home-stat-grid">
          <article className="home-stat-card">
            <span>Attendance</span>
            <strong>Geo-validated</strong>
            <p>Check-in and check-out with location verification and geofence awareness.</p>
          </article>
          <article className="home-stat-card">
            <span>Field Tasks</span>
            <strong>Supervisor-led</strong>
            <p>Assign zone tasks, track status live, and review before/after site proof.</p>
          </article>
          <article className="home-stat-card">
            <span>Monitoring</span>
            <strong>Real-time map</strong>
            <p>See worker movement, task zones, and operational updates on the dashboard map.</p>
          </article>
        </div>
      </section>

      <section className="home-feature-grid">
        <article className="panel home-feature-card">
          <h2>What Workers Use</h2>
          <p>Receive assigned tasks, share live location, upload before/after work images, and track attendance status.</p>
        </article>
        <article className="panel home-feature-card">
          <h2>What Supervisors Use</h2>
          <p>Create tasks by zone, assign workers, monitor live movement, and review task completion through the control center.</p>
        </article>
      </section>
    </main>
  );
}

function RoleShell({
  user,
  title,
  subtitle,
  onLogout,
  children
}: {
  user: AuthUser;
  title: string;
  subtitle: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{user.role} workspace</p>
          <h1>{title}</h1>
          <p className="hero-copy">{subtitle}</p>
        </div>
        <div className="status-card">
          <span>Signed In</span>
          <strong>{user.fullName}</strong>
          <small>{user.email}</small>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}

function LoginView({
  loading,
  helperText,
  onLogin
}: {
  loading: boolean;
  helperText: string;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="auth-shell">
      <AuthCard title="Login" description="Use your existing email and password to create a JWT-backed session.">
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onLogin(email, password);
          }}
        >
          <label>
            Email
            <input autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            Login
          </button>
        </form>

        <p className="helper-text">{helperText || "Use the credentials created during signup."}</p>
        <button type="button" className="link-button" onClick={() => navigate("/signup")}>
          Need an account? Sign up
        </button>
      </AuthCard>
    </main>
  );
}

function SignupView({
  loading,
  onSignup
}: {
  loading: boolean;
  onSignup: (payload: {
    fullName: string;
    phone: string;
    role: Exclude<Role, "admin">;
    aadhaarNumber: string;
    wardId?: string | null;
    email: string;
    password: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    role: "worker" as Exclude<Role, "admin">,
    aadhaarNumber: "",
    email: "",
    password: ""
  });

  return (
    <main className="auth-shell">
      <AuthCard title="Create Account" description="Signup stores worker and supervisor accounts in PostgreSQL.">
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSignup({
              ...form,
              wardId
            });
          }}
        >
          <label>
            Full name
            <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <label>
            Phone
            <input value={form.phone} maxLength={10} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>
            Aadhaar number
            <input
              value={form.aadhaarNumber}
              minLength={12}
              maxLength={12}
              onChange={(event) => setForm((current) => ({ ...current, aadhaarNumber: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              minLength={8}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Exclude<Role, "admin"> }))}
            >
              <option value="worker">Worker</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </label>
          <button type="submit" disabled={loading}>
            Create account
          </button>
        </form>
        <p className="helper-text">Use a 12-digit Aadhaar number and a password with at least 8 characters. Admin signup is disabled.</p>
        <button type="button" className="link-button" onClick={() => navigate("/login")}>
          Already registered? Login
        </button>
      </AuthCard>
    </main>
  );
}

function WorkerView({
  user,
  workerSummary,
  tasks,
  onLogout,
  onUploadProof,
  uploadingStageByTask
}: {
  user: AuthUser;
  workerSummary: {
    attendance: {
      checkedInToday: boolean;
      presentDaysThisMonth: number;
    };
    status: "active" | "idle";
    taskSummary: { assigned: number };
  } | null;
  tasks: TaskItem[];
  onLogout: () => void;
  onUploadProof: (taskId: string, stage: "before" | "after", file: File) => Promise<void>;
  uploadingStageByTask: Record<string, "before" | "after" | null>;
}) {
  return (
    <RoleShell
      user={user}
      title="Worker Field Console"
      subtitle="Handle attendance, view assigned tasks, and upload geo-tagged work proofs."
      onLogout={onLogout}
    >
      <section className="filter-strip panel">
        <div>
          <span className="filter-label">Assigned Tasks</span>
          <strong>{workerSummary?.taskSummary.assigned ?? 0}</strong>
        </div>
        <div>
          <span className="filter-label">Attendance</span>
          <strong>
            {workerSummary
              ? `${workerSummary.attendance.checkedInToday ? "Checked in today" : "Not checked in"} | ${workerSummary.attendance.presentDaysThisMonth} days this month`
              : "Attendance unavailable"}
          </strong>
        </div>
        <div>
          <span className="filter-label">Status</span>
          <strong>{workerSummary?.status ?? "idle"}</strong>
        </div>
      </section>
      <TaskTable tasks={tasks} onUploadProof={onUploadProof} uploadingStageByTask={uploadingStageByTask} />
    </RoleShell>
  );
}

function SupervisorView({
  user,
  dashboard,
  tasks,
  status,
  onLogout,
  resources,
  selectedGeofenceId,
  onSelectGeofence,
  onCreateTask
}: {
  user: AuthUser;
  dashboard: DashboardOverview;
  tasks: TaskItem[];
  status: string;
  onLogout: () => void;
  resources: {
    workers: Array<{ id: string; name: string; status: string; wardId: string }>;
    geofences: Array<{ id: string; name: string; wardId: string; center: [number, number]; radiusMeters: number; type: "radius" }>;
  };
  selectedGeofenceId: string | null;
  onSelectGeofence: (geofenceId: string) => void;
  onCreateTask: (payload: {
    title: string;
    description?: string;
    geofenceId: string;
    assignedTo: string;
    dueAt?: string;
    priority?: "low" | "medium" | "high" | "critical";
  }) => Promise<void>;
}) {
  return (
    <RoleShell
      user={user}
      title="Supervisor Control Center"
      subtitle="Monitor live worker movement, review field tasks, and act on ward-level exceptions."
      onLogout={onLogout}
    >
      <section className="filter-strip panel">
        <div>
          <span className="filter-label">System Status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span className="filter-label">Visible Workers</span>
          <strong>{dashboard.map.workers.length}</strong>
        </div>
        <div>
          <span className="filter-label">Geofences</span>
          <strong>{dashboard.map.geofences.length}</strong>
        </div>
        <div>
          <span className="filter-label">Task Live Status</span>
          <strong>
            {dashboard.analytics.taskStatusSummary.pending} pending / {dashboard.analytics.taskStatusSummary.inProgress} active
          </strong>
        </div>
      </section>
      <KpiCards stats={dashboard.kpis} />
      <section className="layout-grid">
        <MapPanel
          workers={dashboard.map.workers}
          geofences={dashboard.map.geofences}
          tasks={dashboard.map.tasks}
          selectedGeofenceId={selectedGeofenceId}
        />
        <section className="panel analytics-panel">
          <div className="panel-header">
            <h2>Supervisor Analytics</h2>
            <span>Team compliance and field productivity</span>
          </div>
          <div className="analytics-visual-grid">
            <AttendanceTrendChart items={dashboard.analytics.attendanceTrend} />
            <ProductivityBars items={dashboard.analytics.productivity} />
          </div>
        </section>
      </section>
      <section className="layout-grid">
        <SupervisorTaskComposer
          workers={resources.workers}
          geofences={resources.geofences}
          onSelectGeofence={onSelectGeofence}
          onCreateTask={onCreateTask}
        />
        <AttendanceLeaderboard items={dashboard.analytics.attendanceLeaderboard} />
      </section>
      <TaskKanbanBoard tasks={tasks} recentCompletedTasks={dashboard.analytics.recentCompletedTasks} />
      <TaskTable tasks={tasks} />
    </RoleShell>
  );
}

function AdminView({
  user,
  dashboard,
  tasks,
  reports,
  onLogout
}: {
  user: AuthUser;
  dashboard: DashboardOverview;
  tasks: TaskItem[];
  reports: { attendance: { format: string; generatedAt: string; downloadUrl: string }; exports: string[] } | null;
  onLogout: () => void;
}) {
  return (
    <RoleShell
      user={user}
      title="Admin Governance Dashboard"
      subtitle="Review city-wide KPIs, exports, and role-governed operational access."
      onLogout={onLogout}
    >
      <section className="filter-strip panel">
        <div>
          <span className="filter-label">Exports</span>
          <strong>{reports?.exports.join(", ") ?? "pdf, csv"}</strong>
        </div>
        <div>
          <span className="filter-label">Latest Report</span>
          <strong>{reports?.attendance.format.toUpperCase() ?? "PDF"}</strong>
        </div>
        <div>
          <span className="filter-label">Audit Trail</span>
          <strong>Enabled</strong>
        </div>
      </section>
      <KpiCards stats={dashboard.kpis} />
      <section className="layout-grid">
        <MapPanel workers={dashboard.map.workers} geofences={dashboard.map.geofences} />
        <section className="panel analytics-panel">
          <div className="panel-header">
            <h2>Export and Compliance</h2>
            <span>Admin-only reporting surface</span>
          </div>
          <div className="analytics-list">
            <article>
              <strong>Attendance Report</strong>
              <p>{reports ? `${reports.attendance.generatedAt} | ${reports.attendance.downloadUrl}` : "Not generated yet"}</p>
            </article>
            <article>
              <strong>Activity Heatmap Points</strong>
              <p>{dashboard.analytics.heatmap.length} active density records ready for map overlays.</p>
            </article>
          </div>
        </section>
      </section>
      <TaskTable tasks={tasks} />
    </RoleShell>
  );
}

export default function App() {
  const [route, setRoute] = useState<PublicRoutePath>(getInitialRoute());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview>(fallbackDashboard);
  const [tasks, setTasks] = useState<TaskItem[]>(fallbackTasks);
  const [workerSummary, setWorkerSummary] = useState<{
    attendance: {
      checkedInToday: boolean;
      presentDaysThisMonth: number;
    };
    status: "active" | "idle";
    taskSummary: { assigned: number };
  } | null>(null);
  const [reports, setReports] = useState<{
    attendance: { format: string; generatedAt: string; downloadUrl: string };
    exports: string[];
  } | null>(null);
  const [status, setStatus] = useState("Awaiting authentication");
  const [uploadingStageByTask, setUploadingStageByTask] = useState<Record<string, "before" | "after" | null>>({});
  const [loading, setLoading] = useState(false);
  const [authHint, setAuthHint] = useState("");
  const [error, setError] = useState("");
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string | null>(null);
  const [workerLastKnownLocation, setWorkerLastKnownLocation] = useState<WorkerOfflineSnapshot["location"]>(null);
  const [supervisorResources, setSupervisorResources] = useState<{
    workers: Array<{ id: string; name: string; status: string; wardId: string }>;
    geofences: Array<{ id: string; name: string; wardId: string; center: [number, number]; radiusMeters: number; type: "radius" }>;
  }>({
    workers: [],
    geofences: []
  });

  useEffect(() => {
    const handlePopState = () => setRoute(getInitialRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("civictrack_token");
    if (!token) {
      return;
    }

    setAuthToken(token);

    const cachedUser = readCachedUser();
    if (cachedUser) {
      setUser(cachedUser);
      navigate(routeForRole(cachedUser.role));
      return;
    }

    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        localStorage.setItem("civictrack_user", JSON.stringify(currentUser));
        setUser(currentUser);
        navigate(routeForRole(currentUser.role));
      })
      .catch(() => {
        localStorage.removeItem("civictrack_token");
        localStorage.removeItem("civictrack_user");
      });
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (user.role === "worker" && route !== "/worker") {
      navigate("/worker");
      return;
    }

    if (user.role === "supervisor" && route !== "/supervisor") {
      navigate("/supervisor");
      return;
    }

    if (user.role === "admin" && route !== "/admin") {
      navigate("/admin");
      return;
    }

    if (route === "/worker") {
      Promise.all([getWorkerDashboard(), getWorkerTasks()])
        .then(([workerData, taskData]) => {
          setWorkerSummary({
            attendance: workerData.attendance,
            status: workerData.status,
            taskSummary: workerData.taskSummary
          });
          setTasks(taskData.items);
          setStatus("Worker session ready");
          socket.connect();
          socket.emit("presence:join", { userId: user.id, role: user.role });
        })
        .catch((routeError) => {
          const cachedSnapshot = readWorkerOfflineSnapshot();
          if (cachedSnapshot && cachedSnapshot.workerId === user.id) {
            setWorkerSummary(cachedSnapshot.summary);
            setTasks(cachedSnapshot.assignedTasks);
            setWorkerLastKnownLocation(cachedSnapshot.location);
            setStatus("Worker offline mode: showing locally cached tasks and location");
            setError("");
            return;
          }

          setError((routeError as Error).message);
        });
      return () => {
        socket.disconnect();
      };
    }

    if (route === "/supervisor") {
      Promise.all([getSupervisorDashboard(), getTasks(), getSupervisorResources()])
        .then(([dashboardData, taskData, resourceData]) => {
          setDashboard(dashboardData);
          setTasks(taskData.items);
          setSupervisorResources(resourceData);
          setSelectedGeofenceId(resourceData.geofences[0]?.id ?? null);
          setStatus("Supervisor live view connected");
          socket.connect();
          socket.emit("presence:join", { userId: user.id, role: user.role });
        })
        .catch((routeError) => setError((routeError as Error).message));
      return () => {
        socket.disconnect();
      };
    }

    if (route === "/admin") {
      Promise.all([getAdminDashboard(), getTasks(), getAdminReports()])
        .then(([dashboardData, taskData, reportData]) => {
          setDashboard(dashboardData);
          setTasks(taskData.items);
          setReports(reportData);
          setStatus("Admin analytics loaded");
          socket.connect();
          socket.emit("presence:join", { userId: user.id, role: user.role });
        })
        .catch((routeError) => setError((routeError as Error).message));
      return () => {
        socket.disconnect();
      };
    }
  }, [route, user]);

  useEffect(() => {
    if (route !== "/worker" || user?.role !== "worker" || !workerSummary) {
      return;
    }

    writeWorkerOfflineSnapshot({
      workerId: user.id,
      workerName: user.fullName,
      assignedTasks: tasks,
      summary: workerSummary,
      location: workerLastKnownLocation,
      updatedAt: new Date().toISOString()
    });
  }, [route, tasks, user, workerSummary, workerLastKnownLocation]);

  useEffect(() => {
    const handleTracking = (payload: TrackingUpdate) => {
      setDashboard((current) => ({
        ...current,
        map: {
          ...current.map,
          workers: (() => {
            const existingWorker = current.map.workers.find((worker) => worker.id === payload.userId);
            if (existingWorker) {
              return current.map.workers.map((worker) =>
                worker.id === payload.userId
                  ? {
                      ...worker,
                      latitude: payload.latitude,
                      longitude: payload.longitude,
                      lastSeenAt: payload.capturedAt,
                      status: "moving",
                      anomalyDetected: payload.anomalyDetected,
                      anomalyReasons: payload.anomalyReasons ?? []
                    }
                  : worker
              );
            }

            const knownWorker = supervisorResources.workers.find((worker) => worker.id === payload.userId);
            if (!knownWorker) {
              return current.map.workers;
            }

            return [
              {
                id: knownWorker.id,
                name: knownWorker.name,
                role: "worker",
                latitude: payload.latitude,
                longitude: payload.longitude,
                status: "moving",
                anomalyDetected: payload.anomalyDetected,
                anomalyReasons: payload.anomalyReasons ?? [],
                lastSeenAt: payload.capturedAt,
                wardId: knownWorker.wardId
              },
              ...current.map.workers
            ];
          })()
        }
      }));
    };

    const handleTrackingOffline = (payload: TrackingOfflineUpdate) => {
      setDashboard((current) => ({
        ...current,
        map: {
          ...current.map,
          workers: current.map.workers.filter((worker) => worker.id !== payload.userId)
        }
      }));
    };

    socket.on("tracking:update", handleTracking);
    socket.on("tracking:offline", handleTrackingOffline);
    return () => {
      socket.off("tracking:update", handleTracking);
      socket.off("tracking:offline", handleTrackingOffline);
    };
  }, [supervisorResources.workers]);

  useEffect(() => {
    const handleTaskAssigned = (payload: TaskAssignedUpdate) => {
      if (user?.role !== "worker") {
        return;
      }

      let taskWasAlreadyPresent = false;
      setTasks((current) => {
        taskWasAlreadyPresent = current.some((task) => task.id === payload.id);
        return [payload, ...current.filter((task) => task.id !== payload.id)];
      });
      setWorkerSummary((current) =>
        current
          ? {
              ...current,
              status: "active",
              taskSummary: {
                assigned: current.taskSummary.assigned + (taskWasAlreadyPresent ? 0 : 1)
              }
            }
          : current
      );
      setStatus("New task assigned");
    };

    socket.on("task:assigned", handleTaskAssigned);
    return () => {
      socket.off("task:assigned", handleTaskAssigned);
    };
  }, [user?.role]);

  useEffect(() => {
    const handleTaskUpdated = (payload: TaskAssignedUpdate) => {
      setTasks((current) => current.map((task) => (task.id === payload.id ? { ...task, ...payload } : task)));

      if (user?.role === "supervisor" || user?.role === "admin") {
        setDashboard((current) => {
          const nextMapTasks = current.map.tasks.map((task) =>
            task.id === payload.id
              ? {
                  ...task,
                  title: payload.title,
                  status: payload.status,
                  geofenceId: payload.geofenceId ?? null,
                  assignedWorkerName: payload.assignedWorkerName
                }
              : task
          );

          const nextAllTasks = tasks.map((task) => (task.id === payload.id ? { ...task, ...payload } : task));
          const nextPending = nextAllTasks.filter((task) => task.status !== "completed").length;
          const nextCompleted = nextAllTasks.filter((task) => task.status === "completed").length;
          const nextInProgress = nextAllTasks.filter((task) => task.status === "in_progress").length;

          return {
            ...current,
            map: {
              ...current.map,
              tasks: nextMapTasks
            },
            analytics: {
              ...current.analytics,
              taskStatusSummary: {
                pending: nextPending,
                completed: nextCompleted,
                inProgress: nextInProgress
              }
            }
          };
        });
      }
    };

    socket.on("task:updated", handleTaskUpdated);
    return () => {
      socket.off("task:updated", handleTaskUpdated);
    };
  }, [tasks, user?.role]);

  useEffect(() => {
    if (route !== "/worker" || user?.role !== "worker") {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    let loginAttendanceSynced = false;

    const sendLocationPing = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            capturedAt: new Date().toISOString()
          };

          setWorkerLastKnownLocation(nextLocation);

          if (!loginAttendanceSynced) {
            try {
              const attendanceResult = await autoMarkWorkerLoginAttendance({
                latitude: nextLocation.latitude,
                longitude: nextLocation.longitude,
                accuracyMeters: position.coords.accuracy,
                capturedAt: nextLocation.capturedAt
              });

              if (
                attendanceResult.marked ||
                attendanceResult.updatedExisting ||
                attendanceResult.reason === "already_marked_within_24_hours"
              ) {
                loginAttendanceSynced = true;
                const workerData = await getWorkerDashboard();
                setWorkerSummary({
                  attendance: workerData.attendance,
                  status: workerData.status,
                  taskSummary: workerData.taskSummary
                });
              }
            } catch {
              // Keep trying again on the next successful location read.
            }
          }

          socket.emit("tracking:ping", {
            userId: user.id,
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude,
            accuracyMeters: position.coords.accuracy,
            batteryLevel: undefined,
            capturedAt: nextLocation.capturedAt
          });
        },
        () => undefined,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    };

    sendLocationPing();
    const intervalId = window.setInterval(sendLocationPing, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [route, user]);

  async function handleLogin(email: string, password: string) {
    try {
      setLoading(true);
      setError("");
      const result = await login({ email, password });
      localStorage.setItem("civictrack_token", result.accessToken);
      localStorage.setItem("civictrack_user", JSON.stringify(result.user));
      setAuthToken(result.accessToken);
      setUser(result.user);
      navigate(routeForRole(result.user.role));
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(payload: {
    fullName: string;
    phone: string;
    role: Exclude<Role, "admin">;
    aadhaarNumber: string;
    wardId?: string | null;
    email: string;
    password: string;
  }) {
    try {
      setLoading(true);
      setError("");
      const result = await signup(payload);
      setAuthHint(result.message);
      navigate("/login");
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSupervisorTask(payload: {
    title: string;
    description?: string;
    geofenceId: string;
    assignedTo: string;
    dueAt?: string;
    priority?: "low" | "medium" | "high" | "critical";
  }) {
    try {
      setError("");
      const createdTask = await createSupervisorTask(payload);
      setTasks((current) => [createdTask, ...current]);
      setDashboard((current) => ({
        ...current,
        map: {
          ...current.map,
          tasks: [
            {
              id: createdTask.id,
              title: createdTask.title,
              status: createdTask.status,
              geofenceId: createdTask.geofenceId ?? null,
              assignedWorkerName: createdTask.assignedWorkerName
            },
            ...current.map.tasks
          ]
        },
        analytics: {
          ...current.analytics,
          taskStatusSummary: {
            ...current.analytics.taskStatusSummary,
            pending: current.analytics.taskStatusSummary.pending + (createdTask.status === "completed" ? 0 : 1),
            inProgress:
              current.analytics.taskStatusSummary.inProgress + (createdTask.status === "in_progress" ? 1 : 0),
            completed: current.analytics.taskStatusSummary.completed + (createdTask.status === "completed" ? 1 : 0)
          }
        }
      }));
      setSelectedGeofenceId(payload.geofenceId);
      setStatus("Supervisor task assigned successfully");
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function handleUploadTaskProof(taskId: string, stage: "before" | "after", file: File) {
    try {
      setError("");
      setUploadingStageByTask((current) => ({ ...current, [taskId]: stage }));

      if (!authToken) {
        throw new Error("Session expired. Please login again before uploading proof.");
      }

      const imageUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
      });

      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (value) => resolve(value),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });

      const result = await uploadTaskProof(taskId, {
        imageUrl,
        latitude: position?.coords.latitude ?? 0,
        longitude: position?.coords.longitude ?? 0,
        capturedAt: new Date().toISOString(),
        stage,
        metadata: {
          filename: file.name,
          mimeType: file.type
        }
      }, authToken);

      if (result.updatedTask) {
        setTasks((current) => current.map((task) => (task.id === taskId ? result.updatedTask! : task)));
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setUploadingStageByTask((current) => ({ ...current, [taskId]: null }));
    }
  }

  function handleLogout() {
    socket.disconnect();
    logout()
      .catch(() => undefined)
      .finally(() => {
        localStorage.removeItem("civictrack_token");
        localStorage.removeItem("civictrack_user");
        setAuthToken(null);
        setUser(null);
        setRoute("/");
        setTasks([]);
        setDashboard(fallbackDashboard);
        setWorkerSummary(null);
        setReports(null);
        setAuthHint("");
        setStatus("Awaiting authentication");
        setWorkerLastKnownLocation(null);
        localStorage.removeItem(workerOfflineSnapshotKey);
        window.location.replace("/");
      });
  }

  if (!user && route === "/signup") {
    return (
      <>
        {error ? <div className="banner error-banner">{error}</div> : null}
        <SignupView loading={loading} onSignup={handleSignup} />
      </>
    );
  }

  if (!user && route === "/") {
    return (
      <>
        {error ? <div className="banner error-banner">{error}</div> : null}
        <HomeView />
      </>
    );
  }

  if (!user) {
    return (
      <>
        {error ? <div className="banner error-banner">{error}</div> : null}
        <LoginView loading={loading} helperText={authHint} onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      {error ? <div className="banner error-banner">{error}</div> : null}
      {route === "/worker" ? (
        <WorkerView
          user={user}
          workerSummary={workerSummary}
          tasks={tasks}
          onLogout={handleLogout}
          onUploadProof={handleUploadTaskProof}
          uploadingStageByTask={uploadingStageByTask}
        />
      ) : null}
      {route === "/supervisor" ? (
        <SupervisorView
          user={user}
          dashboard={dashboard}
          tasks={tasks}
          status={status}
          onLogout={handleLogout}
          resources={supervisorResources}
          selectedGeofenceId={selectedGeofenceId}
          onSelectGeofence={setSelectedGeofenceId}
          onCreateTask={handleCreateSupervisorTask}
        />
      ) : null}
      {route === "/admin" ? <AdminView user={user} dashboard={dashboard} tasks={tasks} reports={reports} onLogout={handleLogout} /> : null}
    </>
  );
}
