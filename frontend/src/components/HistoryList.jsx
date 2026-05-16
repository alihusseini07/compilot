import { useState } from "react";
import ReportCard from "./ReportCard";

export default function HistoryList({ reports, type }) {
  const [open, setOpen] = useState(false);
  if (!reports || reports.length === 0) return null;

  return (
    <div className="history-section">
      <button className="history-toggle" onClick={() => setOpen(o => !o)}>
        <span className={`history-toggle-icon${open ? " open" : ""}`}>▶</span>
        Past {type} reports ({reports.length})
      </button>
      {open && reports.map(r => (
        <ReportCard key={r.id} report={r} type={type} isLatest={false} />
      ))}
    </div>
  );
}
