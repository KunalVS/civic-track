import { type ReactNode, useEffect, useState } from "react";
import { KpiCards } from "./components/KpiCards";
import { MapPanel } from "./components/MapPanel";
import { TaskTable } from "./components/TaskTable";
import {
  type AuthUser,
  type DashboardOverview,
  type Role,
  getAdminDashboard,
  getAdminReports,
  getCurrentUser,
  getSupervisorDashboard,
  getTasks,
  getWorkerDashboard,
  getWorkerTasks,
  login,
  logout,
  signup
} from "./lib/api";
import { socket } from "./lib/socket";

type RoutePath = "/login" | "/signup" | "/worker" | "/supervisor" | "/admin";

interface TrackingUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
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
}

const wardId = "11111111-1111-1111-1111-111111111111";

const fallbackDashboard: DashboardOverview = {
  kpis: {
    activeWorkers: 0,
    checkedInToday: 0,
    tasksCompletedToday: 0,
    slaCompliancePercent: 0
  },
  map: {
    workers: [],
    geofences: []
  },
  analytics: {
    attendanceTrend: [],
    productivity: [],
    heatmap: []
  }
};

const fallbackTasks: TaskItem[] = [];

function getInitialRoute(): RoutePath {
  const path = window.location.pathname as RoutePath;
  return ["/login", "/signup", "/worker", "/supervisor", "/admin"].includes(path) ? path : "/login";
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

function navigate(path: RoutePath) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
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
  const [email, setEmail] = useState("supervisor@civictrack.local");
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
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
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
  onLogout
}: {
  user: AuthUser;
  workerSummary: { quickActions: string[]; taskSummary: { assigned: number } } | null;
  tasks: TaskItem[];
  onLogout: () => void;
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
          <span className="filter-label">Quick Actions</span>
          <strong>{workerSummary?.quickActions.join(", ") ?? "check_in, upload_proof"}</strong>
        </div>
        <div>
          <span className="filter-label">Auth Mode</span>
          <strong>Email + Password</strong>
        </div>
      </section>
      <TaskTable tasks={tasks} />
    </RoleShell>
  );
}

function SupervisorView({
  user,
  dashboard,
  tasks,
  status,
  onLogout
}: {
  user: AuthUser;
  dashboard: DashboardOverview;
  tasks: TaskItem[];
  status: string;
  onLogout: () => void;
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
      </section>
      <KpiCards stats={dashboard.kpis} />
      <section className="layout-grid">
        <MapPanel workers={dashboard.map.workers} geofences={dashboard.map.geofences} />
        <section className="panel analytics-panel">
          <div className="panel-header">
            <h2>Supervisor Analytics</h2>
            <span>Team compliance and field productivity</span>
          </div>
          <div className="analytics-list">
            <article>
              <strong>Attendance Trend</strong>
              <p>{dashboard.analytics.attendanceTrend.map((item) => `${item.date}: ${item.present}`).join(" | ")}</p>
            </article>
            <article>
              <strong>Productivity</strong>
              <p>{dashboard.analytics.productivity.map((item) => `${item.label}: ${item.value}`).join(" | ")}</p>
            </article>
          </div>
        </section>
      </section>
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
  const [route, setRoute] = useState<RoutePath>(getInitialRoute());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview>(fallbackDashboard);
  const [tasks, setTasks] = useState<TaskItem[]>(fallbackTasks);
  const [workerSummary, setWorkerSummary] = useState<{
    quickActions: string[];
    taskSummary: { assigned: number };
  } | null>(null);
  const [reports, setReports] = useState<{
    attendance: { format: string; generatedAt: string; downloadUrl: string };
    exports: string[];
  } | null>(null);
  const [status, setStatus] = useState("Awaiting authentication");
  const [loading, setLoading] = useState(false);
  const [authHint, setAuthHint] = useState("");
  const [error, setError] = useState("");

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

    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        navigate(routeForRole(currentUser.role));
      })
      .catch(() => {
        localStorage.removeItem("civictrack_token");
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
            quickActions: workerData.quickActions,
            taskSummary: workerData.taskSummary
          });
          setTasks(taskData.items);
          setStatus("Worker session ready");
        })
        .catch((routeError) => setError((routeError as Error).message));
      return;
    }

    if (route === "/supervisor") {
      Promise.all([getSupervisorDashboard(), getTasks()])
        .then(([dashboardData, taskData]) => {
          setDashboard(dashboardData);
          setTasks(taskData.items);
          setStatus("Supervisor live view connected");
          socket.connect();
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
        })
        .catch((routeError) => setError((routeError as Error).message));
      return () => {
        socket.disconnect();
      };
    }
  }, [route, user]);

  useEffect(() => {
    const handleTracking = (payload: TrackingUpdate) => {
      setDashboard((current) => ({
        ...current,
        map: {
          ...current.map,
          workers: current.map.workers.map((worker) =>
            worker.id === payload.userId
              ? {
                  ...worker,
                  latitude: payload.latitude,
                  longitude: payload.longitude,
                  lastSeenAt: payload.capturedAt,
                  status: "moving"
                }
              : worker
          )
        }
      }));
    };

    socket.on("tracking:update", handleTracking);
    return () => {
      socket.off("tracking:update", handleTracking);
    };
  }, []);

  async function handleLogin(email: string, password: string) {
    try {
      setLoading(true);
      setError("");
      const result = await login({ email, password });
      localStorage.setItem("civictrack_token", result.accessToken);
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

  function handleLogout() {
    logout()
      .catch(() => undefined)
      .finally(() => {
        localStorage.removeItem("civictrack_token");
        setUser(null);
        setTasks([]);
        setDashboard(fallbackDashboard);
        setWorkerSummary(null);
        setReports(null);
        setAuthHint("");
        setStatus("Awaiting authentication");
        navigate("/login");
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
      {route === "/worker" ? <WorkerView user={user} workerSummary={workerSummary} tasks={tasks} onLogout={handleLogout} /> : null}
      {route === "/supervisor" ? (
        <SupervisorView user={user} dashboard={dashboard} tasks={tasks} status={status} onLogout={handleLogout} />
      ) : null}
      {route === "/admin" ? <AdminView user={user} dashboard={dashboard} tasks={tasks} reports={reports} onLogout={handleLogout} /> : null}
    </>
  );
}
