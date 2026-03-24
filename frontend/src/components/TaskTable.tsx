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

export function TaskTable({ tasks }: { tasks: TaskItem[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Field Tasks</h2>
        <button type="button">Export CSV</button>
      </div>
      <table className="task-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assigned</th>
            <th>Proofs</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td>{task.status}</td>
              <td>{task.priority}</td>
              <td>{task.assignedWorkerName}</td>
              <td>{task.completedProofs}/{task.expectedPhotoCount}</td>
              <td>{new Date(task.dueAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
