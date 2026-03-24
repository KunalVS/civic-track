interface KpiCardsProps {
  stats: {
    activeWorkers: number;
    checkedInToday: number;
    tasksCompletedToday: number;
    slaCompliancePercent: number;
  };
}

export function KpiCards({ stats }: KpiCardsProps) {
  const items = [
    { label: "Active Workers", value: stats.activeWorkers },
    { label: "Checked In", value: stats.checkedInToday },
    { label: "Tasks Completed", value: stats.tasksCompletedToday },
    { label: "SLA Compliance", value: `${stats.slaCompliancePercent}%` }
  ];

  return (
    <section className="kpi-grid">
      {items.map((item) => (
        <article key={item.label} className="kpi-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}
