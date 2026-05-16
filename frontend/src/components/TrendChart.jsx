import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDateKey(report, type) {
  if (type === "daily") return report.report_date;
  if (type === "weekly") return report.week_start;
  return report.month_start;
}

export default function TrendChart({ history, type }) {
  const data = [...history]
    .reverse()
    .map((r) => ({
      date: formatDate(getDateKey(r, type)),
      signals: r.signal_count ?? 1,
    }));

  if (data.length < 2) {
    return (
      <p className="text-xs text-zinc-600 italic py-2">
        Need at least 2 reports to show a trend.
      </p>
    );
  }

  return (
    <div className="mt-3 h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "JetBrains Mono",
              color: "#e4e4e7",
            }}
            cursor={{ stroke: "#8b5cf6", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="signals"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ fill: "#8b5cf6", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "#a78bfa" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
