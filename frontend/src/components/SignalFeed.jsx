const SOURCE_COLORS = {
  github: "#f472b6",
  news: "#34d399",
  jobs: "#fbbf24",
  patents: "#60a5fa",
  pricing: "#a78bfa",
};

const SOURCE_ICONS = {
  github: "⬡",
  news: "◈",
  jobs: "◆",
  patents: "◇",
  pricing: "◉",
};

/**
 * Scrollable list of raw signals, sorted newest-first.
 * Each row shows source badge, company, truncated content, and timestamp.
 */
export default function SignalFeed({ signals }) {
  if (!signals.length) {
    return <p style={{ color: "#475569", fontSize: "0.85rem" }}>No signals yet.</p>;
  }

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: "12px",
        overflow: "hidden",
        maxHeight: "360px",
        overflowY: "auto",
      }}
    >
      {signals.map((sig) => (
        <div
          key={sig.id}
          style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid #1e293b",
            background: "#1e293b",
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: SOURCE_COLORS[sig.source_type] || "#94a3b8",
              background: "#0f172a",
              padding: "0.2rem 0.4rem",
              borderRadius: "4px",
              flexShrink: 0,
              marginTop: "2px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {SOURCE_ICONS[sig.source_type]} {sig.source_type}
          </span>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: "0.82rem",
                color: "#cbd5e1",
                lineHeight: 1.4,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {sig.content}
            </p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.72rem", color: "#475569" }}>
              {sig.scraped_at ? new Date(sig.scraped_at).toLocaleString() : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
