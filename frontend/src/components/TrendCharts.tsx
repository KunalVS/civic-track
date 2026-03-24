interface AttendanceTrendPoint {
  date: string;
  present: number;
}

interface ProductivityPoint {
  label: string;
  value: number;
}

function buildPolyline(points: AttendanceTrendPoint[]) {
  if (points.length === 0) {
    return "";
  }

  const maxValue = Math.max(...points.map((point) => point.present), 1);

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - (point.present / maxValue) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

export function AttendanceTrendChart({ items }: { items: AttendanceTrendPoint[] }) {
  const polyline = buildPolyline(items);

  return (
    <article className="analytics-card chart-card">
      <div className="chart-header">
        <div>
          <strong>Attendance Trend</strong>
          <p>Daily check-in presence across the active ward team.</p>
        </div>
      </div>
      <div className="line-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Attendance trend chart">
          <defs>
            <linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(157, 231, 219, 0.5)" />
              <stop offset="100%" stopColor="rgba(157, 231, 219, 0.05)" />
            </linearGradient>
          </defs>
          <polyline className="line-chart-grid" points="0,80 100,80" />
          <polyline className="line-chart-grid" points="0,50 100,50" />
          <polyline className="line-chart-grid" points="0,20 100,20" />
          {polyline ? <polyline className="line-chart-fill" points={`0,100 ${polyline} 100,100`} /> : null}
          {polyline ? <polyline className="line-chart-path" points={polyline} /> : null}
        </svg>
      </div>
      <div className="chart-axis">
        {items.map((item) => (
          <span key={item.date}>
            <strong>{item.present}</strong>
            <small>{item.date.slice(5)}</small>
          </span>
        ))}
      </div>
    </article>
  );
}

export function ProductivityBars({ items }: { items: ProductivityPoint[] }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <article className="analytics-card chart-card">
      <div className="chart-header">
        <div>
          <strong>Productivity</strong>
          <p>Output comparison across the main field execution indicators.</p>
        </div>
      </div>
      <div className="bar-chart">
        {items.map((item) => (
          <div key={item.label} className="bar-row">
            <div className="bar-meta">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(item.value / maxValue) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
