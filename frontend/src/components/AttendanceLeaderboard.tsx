interface AttendanceRecord {
  workerId: string;
  workerName: string;
  daysPresent: number;
  attendanceRate: number;
  completedTasks: number;
  rank: number;
}

export function AttendanceLeaderboard({
  items
}: {
  items: AttendanceRecord[];
}) {
  function escapeCsv(value: string | number) {
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  function handleExportCsv() {
    const headers = ["Rank", "Worker", "Present Days", "Attendance Rate", "Completed Tasks"];
    const rows = items.map((item) => [
      item.rank,
      item.workerName,
      item.daysPresent,
      `${item.attendanceRate}%`,
      item.completedTasks
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Attendance Analytics</h2>
        <button type="button" onClick={handleExportCsv}>
          Export CSV
        </button>
      </div>
      <table className="task-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Worker</th>
            <th>Present Days</th>
            <th>Attendance Rate</th>
            <th>Completed Tasks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.workerId}>
              <td>#{item.rank}</td>
              <td>{item.workerName}</td>
              <td>{item.daysPresent}</td>
              <td>{item.attendanceRate}%</td>
              <td>{item.completedTasks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
