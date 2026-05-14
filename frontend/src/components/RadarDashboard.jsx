import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const SOURCE_LABELS = {
  github: "GitHub",
  news: "News",
  jobs: "Jobs",
  patents: "Patents",
  pricing: "Pricing",
};

/**
 * Renders a radar chart showing signal volume by source type.
 * Each axis = one scraper source. Value = number of signals from that source.
 */
export default function RadarDashboard({ signals }) {
  const counts = Object.fromEntries(Object.keys(SOURCE_LABELS).map((k) => [k, 0]));
  for (const sig of signals) {
    if (sig.source_type in counts) counts[sig.source_type]++;
  }

  const data = Object.entries(SOURCE_LABELS).map(([key, label]) => ({
    subject: label,
    value: counts[key],
    fullMark: Math.max(...Object.values(counts), 1),
  }));

  return (
    <div style={{ background: "#1e293b", borderRadius: "12px", padding: "1rem" }}>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <PolarRadiusAxis tick={{ fill: "#64748b", fontSize: 10 }} />
          <Radar
            name="Signals"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.35}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
            labelStyle={{ color: "#e2e8f0" }}
            itemStyle={{ color: "#a5b4fc" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
