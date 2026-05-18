import { useState } from "react";
import { ChevronDown, ChevronUp, Download, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "../lib/utils";
import TrendChart from "./TrendChart";

function dateLabel(report, type) {
  const raw =
    type === "daily"
      ? report.report_date
      : type === "weekly"
      ? report.week_start
      : report.month_start;
  if (!raw) return "";
  const d = new Date(raw + "T00:00:00");
  if (type === "daily")
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (type === "weekly")
    return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const CONFIDENCE_STYLES = {
  high: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  low: "bg-red-500/10 text-red-400 border border-red-500/20",
  none: "bg-zinc-800/60 text-zinc-500 border border-zinc-700",
};

const TYPE_STYLES = {
  daily: "bg-sky-400/10 text-sky-400 border border-sky-400/20",
  weekly: "bg-sky-400/10 text-sky-400 border border-sky-400/20",
  monthly: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
};

function exportMarkdown(report, type) {
  const date = dateLabel(report, type);
  const insights = Array.isArray(report.key_insights)
    ? report.key_insights.map((i) => `- ${i}`).join("\n")
    : "";
  const md = [
    `# ${report.company || "Competitor"} — ${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
    `**Date:** ${date}`,
    report.overall_confidence ? `**Confidence:** ${report.overall_confidence}` : null,
    "",
    report.report_text,
    insights ? `\n## Key Insights\n${insights}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(report.company || "report").toLowerCase()}-${type}-${date.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportCard({ report, type, isLatest, history = [] }) {
  const [expanded, setExpanded] = useState(isLatest);
  const [showTrend, setShowTrend] = useState(false);
  const insights = Array.isArray(report.key_insights) ? report.key_insights : [];
  const confidence = report.overall_confidence;

  return (
    <div
      className={cn(
        "bg-zinc-900 border rounded-xl p-5 transition-all duration-200",
        isLatest
          ? "border-sky-400/30 shadow-[0_0_20px_rgba(139,92,246,0.08)]"
          : "border-zinc-800 hover:border-zinc-700"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">{dateLabel(report, type)}</span>
          <span className={cn("px-2 py-0.5 rounded-md text-xs font-mono font-medium", TYPE_STYLES[type] ?? TYPE_STYLES.daily)}>
            {type}
          </span>
          {confidence && (
            <span className={cn("px-2 py-0.5 rounded-md text-xs font-mono font-medium", CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.none)}>
              {confidence}
            </span>
          )}
          {report.fallback_used && (
            <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-zinc-800 text-zinc-500 border border-zinc-700">
              fallback
            </span>
          )}
          {isLatest && (
            <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-sky-400/10 text-blue-300 border border-sky-400/20">
              latest
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {history.length >= 2 && (
            <button
              onClick={() => setShowTrend((p) => !p)}
              className={cn(
                "p-1.5 rounded-md transition-colors text-xs flex items-center gap-1",
                showTrend
                  ? "bg-sky-400/10 text-sky-400"
                  : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
              )}
              title="Toggle trend chart"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => exportMarkdown(report, type)}
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
            title="Export as markdown"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Trend chart */}
      {showTrend && history.length >= 2 && (
        <TrendChart history={history} type={type} />
      )}

      {/* Body */}
      {expanded && (
        <div className="animate-fade-in">
          <div className="text-sm text-zinc-300 leading-relaxed mb-4">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="text-zinc-100 font-semibold">{children}</strong>,
                em: ({ children }) => <em className="text-zinc-300 italic">{children}</em>,
                h1: ({ children }) => <h1 className="text-base font-bold text-zinc-100 mb-2 mt-4 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold text-zinc-100 mb-2 mt-3 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-200 mb-1.5 mt-3 first:mt-0">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-zinc-300">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-zinc-300">{children}</ol>,
                li: ({ children }) => <li className="text-zinc-300">{children}</li>,
              }}
            >
              {report.report_text}
            </ReactMarkdown>
          </div>

          {insights.length > 0 && (
            <div className="border-t border-zinc-800 pt-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">
                Key Insights
              </p>
              <ul className="space-y-2">
                {insights.map((insight, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-zinc-400">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">›</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-zinc-600 hover:text-sky-400 transition-colors"
        >
          Read full report →
        </button>
      )}
    </div>
  );
}
