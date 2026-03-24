interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedWorkerName: string;
  dueAt: string;
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
}

const columns = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" }
] as const;

function formatDueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

export function TaskKanbanBoard({
  tasks,
  recentCompletedTasks = []
}: {
  tasks: TaskItem[];
  recentCompletedTasks?: TaskItem[];
}) {
  return (
    <section className="panel kanban-panel">
      <div className="panel-header">
        <h2>Task Status Board</h2>
        <span>Live operational task flow for supervisor follow-up</span>
      </div>
      <div className="kanban-grid">
        {columns.map((column) => {
          const liveColumnTasks = tasks.filter((task) => task.status === column.key);
          const columnTasks =
            column.key === "completed" && liveColumnTasks.length === 0 ? recentCompletedTasks.slice(0, 3) : liveColumnTasks;
          const showFallbackNote = column.key === "completed" && liveColumnTasks.length === 0 && recentCompletedTasks.length > 0;

          return (
            <section key={column.key} className="kanban-column">
              <header className="kanban-column-header">
                <strong>{column.label}</strong>
                <span>{columnTasks.length}</span>
              </header>
              {showFallbackNote ? <div className="kanban-fallback-note">Showing last 3 completed tasks from records.</div> : null}
              <div className="kanban-stack">
                {columnTasks.length ? (
                  columnTasks.map((task) => (
                    <article key={task.id} className="kanban-card">
                      <div className="kanban-card-header">
                        <strong>{task.title}</strong>
                        <span className={`status-pill status-${task.status}`}>{task.status.replace("_", " ")}</span>
                      </div>
                      <p>{task.assignedWorkerName}</p>
                      {task.beforeImageUrl || task.afterImageUrl ? (
                        <div className="kanban-proof-grid">
                          <div className="kanban-proof-card">
                            <span>Before</span>
                            {task.beforeImageUrl ? <img src={task.beforeImageUrl} alt={`${task.title} before`} /> : <em>Pending</em>}
                          </div>
                          <div className="kanban-proof-card">
                            <span>After</span>
                            {task.afterImageUrl ? <img src={task.afterImageUrl} alt={`${task.title} after`} /> : <em>Pending</em>}
                          </div>
                        </div>
                      ) : null}
                      <div className="kanban-meta">
                        <span>{task.priority}</span>
                        <span>{formatDueDate(task.dueAt)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="kanban-empty">No tasks in this lane.</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
