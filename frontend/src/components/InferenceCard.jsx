import { useState } from "react";

const CONFIDENCE_STYLES = {
  high: { bg: "#052e16", border: "#16a34a", badge: "#22c55e", label: "HIGH" },
  medium: { bg: "#2d1a00", border: "#d97706", badge: "#f59e0b", label: "MED" },
  low: { bg: "#1c0a0a", border: "#dc2626", badge: "#ef4444", label: "LOW" },
};

const CATEGORY_COLORS = {
  product: "#818cf8",
  gtm: "#34d399",
  hiring: "#fbbf24",
  funding: "#60a5fa",
  technical: "#f472b6",
  regulatory: "#a78bfa",
};

/**
 * Displays a single strategic inference from the synthesis agent.
 *
 * Props:
 *   inference — Inference object from the API
 *   signals   — Full signals array (used to look up supporting signal content)
 */
export default function InferenceCard({ inference, signals }) {
  const [expanded, setExpanded] = useState(false);
  const style = CONFIDENCE_STYLES[inference.confidence] || CONFIDENCE_STYLES.low;

  const supportingSignals = (inference.supporting_signal_ids || [])
    .map((id) => signals.find((s) => s.id === id))
    .filter(Boolean);

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "10px",
        padding: "1rem",
        marginBottom: "0.75rem",
      }}
    >
      {/* Header row: confidence badge + category tag */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem", alignItems: "center" }}>
        <span
          style={{
            background: style.badge,
            color: "#000",
            fontSize: "0.65rem",
            fontWeight: 800,
            padding: "0.15rem 0.4rem",
            borderRadius: "4px",
            letterSpacing: "0.06em",
          }}
        >
          {style.label}
        </span>
        <span
          style={{
            color: CATEGORY_COLORS[inference.category] || "#94a3b8",
            fontSize: "0.72rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {inference.category}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#475569" }}>
          {inference.synthesized_at ? new Date(inference.synthesized_at).toLocaleDateString() : ""}
        </span>
      </div>

      {/* Inference text */}
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", color: "#f1f5f9", fontWeight: 500, lineHeight: 1.5 }}>
        {inference.inference}
      </p>

      {/* Reasoning (always visible, slightly muted) */}
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.45 }}>
        {inference.reasoning}
      </p>

      {/* Supporting signals — collapsible */}
      {supportingSignals.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              color: style.badge,
              fontSize: "0.78rem",
              cursor: "pointer",
              padding: 0,
              fontWeight: 600,
            }}
          >
            {expanded ? "▲" : "▼"} {supportingSignals.length} supporting signal{supportingSignals.length !== 1 ? "s" : ""}
          </button>

          {expanded && (
            <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {supportingSignals.map((sig) => (
                <div
                  key={sig.id}
                  style={{
                    background: "#0f172a",
                    borderRadius: "6px",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.78rem",
                    color: "#cbd5e1",
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: "#64748b", marginRight: "0.4rem", textTransform: "uppercase", fontSize: "0.68rem" }}>
                    [{sig.source_type}]
                  </span>
                  {sig.content.slice(0, 180)}
                  {sig.content.length > 180 ? "…" : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
