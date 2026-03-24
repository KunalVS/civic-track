import { useEffect, useState } from "react";

interface WorkerOption {
  id: string;
  name: string;
  status: string;
  wardId: string;
}

interface GeofenceOption {
  id: string;
  name: string;
  wardId: string;
  center: [number, number];
  radiusMeters: number;
  type: "radius";
}

export function SupervisorTaskComposer({
  workers,
  geofences,
  onCreateTask,
  onSelectGeofence
}: {
  workers: WorkerOption[];
  geofences: GeofenceOption[];
  onCreateTask: (payload: {
    title: string;
    description?: string;
    geofenceId: string;
    assignedTo: string;
    dueAt?: string;
    priority?: "low" | "medium" | "high" | "critical";
  }) => Promise<void>;
  onSelectGeofence: (geofenceId: string) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    geofenceId: geofences[0]?.id ?? "",
    assignedTo: workers[0]?.id ?? "",
    dueAt: "",
    priority: "medium" as "low" | "medium" | "high" | "critical"
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      geofenceId: current.geofenceId || geofences[0]?.id || "",
      assignedTo: current.assignedTo || workers[0]?.id || ""
    }));
  }, [geofences, workers]);

  function toIsoDateTime(value: string) {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Create Zone Task</h2>
        <span>Select zone on map, assign worker, track live status</span>
      </div>
      <form
        className="auth-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.geofenceId || !form.assignedTo) {
            return;
          }

          await onCreateTask({
            title: form.title,
            description: form.description || undefined,
            geofenceId: form.geofenceId,
            assignedTo: form.assignedTo,
            dueAt: toIsoDateTime(form.dueAt),
            priority: form.priority
          });
          setForm((current) => ({
            ...current,
            title: "",
            description: "",
            dueAt: "",
            priority: "medium"
          }));
        }}
      >
        <label>
          Task title
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label>
          Description
          <input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </label>
        <label>
          Zone
          <select
            value={form.geofenceId}
            disabled={!geofences.length}
            onChange={(event) => {
              const geofenceId = event.target.value;
              setForm((current) => ({ ...current, geofenceId }));
              onSelectGeofence(geofenceId);
            }}
          >
            {!geofences.length ? <option value="">No zones available</option> : null}
            {geofences.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Worker
          <select
            value={form.assignedTo}
            disabled={!workers.length}
            onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
          >
            {!workers.length ? <option value="">No workers available</option> : null}
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} ({worker.status})
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={form.priority}
            onChange={(event) =>
              setForm((current) => ({ ...current, priority: event.target.value as "low" | "medium" | "high" | "critical" }))
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          Due at
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
          />
        </label>
        <button type="submit" disabled={!form.geofenceId || !form.assignedTo}>
          Assign task
        </button>
      </form>
    </section>
  );
}
