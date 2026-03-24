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

export function TaskTable({
  tasks,
  onUploadProof,
  uploadingStageByTask
}: {
  tasks: TaskItem[];
  onUploadProof?: (taskId: string, stage: "before" | "after", file: File) => Promise<void>;
  uploadingStageByTask?: Record<string, "before" | "after" | null>;
}) {
  async function handleFileSelection(taskId: string, stage: "before" | "after", fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !onUploadProof) {
      return;
    }

    await onUploadProof(taskId, stage, file);
  }

  function formatDue(value: string) {
    if (!value) {
      return "-";
    }

    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) {
      return "-";
    }

    const diffMs = dueDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "Due today";
    }

    return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }

  function escapeCsv(value: string | number | null | undefined) {
    const stringValue = String(value ?? "");
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  function handleExportCsv() {
    const headers = [
      "Task",
      "Status",
      "Priority",
      "Assigned",
      ...(onUploadProof ? ["Before Image", "After Image"] : []),
      "Due"
    ];

    const rows = tasks.map((task) => [
      task.title,
      task.status,
      task.priority,
      task.assignedWorkerName,
      ...(onUploadProof ? [task.beforeImageUrl ? "Uploaded" : "Pending", task.afterImageUrl ? "Uploaded" : "Pending"] : []),
      formatDue(task.dueAt)
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `field-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Field Tasks</h2>
        <button type="button" onClick={handleExportCsv}>
          Export CSV
        </button>
      </div>
      <table className="task-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assigned</th>
            {onUploadProof ? <th>Before</th> : null}
            {onUploadProof ? <th>After</th> : null}
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td><span className={`status-pill status-${task.status}`}>{task.status}</span></td>
              <td>{task.priority}</td>
              <td>{task.assignedWorkerName}</td>
              {onUploadProof ? (
                <td>
                  <label className="upload-chip">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleFileSelection(task.id, "before", event.target.files)}
                      disabled={Boolean(uploadingStageByTask?.[task.id])}
                    />
                    <span>
                      {task.beforeImageUrl ? "Uploaded" : uploadingStageByTask?.[task.id] === "before" ? "Uploading..." : "Upload"}
                    </span>
                  </label>
                </td>
              ) : null}
              {onUploadProof ? (
                <td>
                  <label className="upload-chip">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleFileSelection(task.id, "after", event.target.files)}
                      disabled={Boolean(uploadingStageByTask?.[task.id])}
                    />
                    <span>
                      {task.afterImageUrl ? "Uploaded" : uploadingStageByTask?.[task.id] === "after" ? "Uploading..." : "Upload"}
                    </span>
                  </label>
                </td>
              ) : null}
              <td>{formatDue(task.dueAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
