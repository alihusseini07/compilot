function dateLabel(report, type) {
  const raw = type === "daily" ? report.report_date
    : type === "weekly" ? report.week_start
    : report.month_start;
  if (!raw) return "";
  const d = new Date(raw + "T00:00:00");
  if (type === "daily")
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (type === "weekly")
    return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function ReportCard({ report, type, isLatest }) {
  const insights = Array.isArray(report.key_insights) ? report.key_insights : [];

  return (
    <div className={`report-card${isLatest ? " latest" : ""}`}>
      <div className="card-header">
        <span className="card-date">{dateLabel(report, type)}</span>
        <span className="card-type-chip">{type}</span>
        {type === "daily" && report.overall_confidence && (
          <span className={`badge badge-${report.overall_confidence}`}>
            {report.overall_confidence}
          </span>
        )}
        {report.fallback_used && (
          <span className="badge badge-fallback">fallback</span>
        )}
      </div>

      <p className="card-text">{report.report_text}</p>

      {insights.length > 0 && (
        <>
          <p className="insights-label">Key Insights</p>
          <ul className="insights-list">
            {insights.map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
