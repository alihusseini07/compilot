import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, ArrowRight, Clock, Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { fetchLatest, triggerAnalysis } from "../hooks/useReports";
import { useAuth } from "../hooks/useAuth";

const CONFIDENCE_DOT = {
  high: "bg-emerald-400",
  medium: "bg-amber-400",
  low: "bg-red-400",
  none: "bg-zinc-300",
};

const CONFIDENCE_TEXT = {
  high: "text-emerald-500",
  medium: "text-amber-500",
  low: "text-red-500",
  none: "text-zinc-400",
};

function ConfidenceDot({ level }) {
  return (
    <span className={cn("inline-block w-1.5 h-1.5 rounded-full flex-shrink-0", CONFIDENCE_DOT[level] ?? CONFIDENCE_DOT.none)} />
  );
}

function RelativeTime({ isoString }) {
  if (!isoString) return <span className="text-zinc-300">—</span>;
  const d = new Date(isoString);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  let label;
  if (hours < 1) label = "Just now";
  else if (hours < 24) label = `${hours}h ago`;
  else label = `${days}d ago`;
  return <span className="text-zinc-400 font-mono text-[11px]">{label}</span>;
}

function CompetitorCard({ competitor, token }) {
  const navigate = useNavigate();
  const [latestData, setLatestData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchLatest(competitor.company).then(setLatestData).catch(() => {});
  }, [competitor.company]);

  async function handleQuickAnalyze(e) {
    e.stopPropagation();
    if (analyzing) return;
    setAnalyzing(true);
    try {
      await triggerAnalysis(competitor.company, "daily", token);
    } catch { /* queued */ } finally {
      setAnalyzing(false);
    }
  }

  const daily = latestData?.daily;
  const weekly = latestData?.weekly;
  const monthly = latestData?.monthly;

  return (
    <div
      className="group bg-white/80 border border-zinc-200 hover:border-blue-200 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-blue-100/60 flex flex-col gap-4 backdrop-blur-sm"
      onClick={() => navigate(`/reports/${encodeURIComponent(competitor.company)}`)}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900 group-hover:text-zinc-950 transition-colors font-display">
            {competitor.display_name || competitor.company}
          </h3>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">{competitor.company}</p>
        </div>
        <button
          onClick={handleQuickAnalyze}
          disabled={analyzing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-blue-50 hover:text-blue-600 text-zinc-500 border border-zinc-200 hover:border-blue-200 transition-all disabled:opacity-50"
        >
          {analyzing ? (
            <span className="w-3 h-3 border border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          {analyzing ? "Queued" : "Analyze"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {[
          { key: "daily", data: daily, label: "Daily" },
          { key: "weekly", data: weekly, label: "Weekly" },
          { key: "monthly", data: monthly, label: "Monthly" },
        ].map(({ key, data, label }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ConfidenceDot level={data?.overall_confidence ?? "none"} />
              <span className="text-xs text-zinc-500">{label}</span>
              {data?.overall_confidence && (
                <span className={cn("text-[10px] font-mono", CONFIDENCE_TEXT[data.overall_confidence] ?? CONFIDENCE_TEXT.none)}>
                  {data.overall_confidence}
                </span>
              )}
            </div>
            <RelativeTime isoString={data?.created_at} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Clock className="w-3 h-3" />
          <RelativeTime isoString={competitor.added_at} />
        </div>
        <span className="text-xs text-zinc-400 group-hover:text-blue-500 transition-colors flex items-center gap-1">
          View reports <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

export default function Dashboard({ competitors }) {
  const { token } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 font-display tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Overview of all tracked competitors and their latest intelligence.</p>
      </div>

      {competitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center mb-5 shadow-sm">
            <Plus className="w-7 h-7 text-zinc-400" />
          </div>
          <h3 className="text-base font-semibold text-zinc-700 font-display mb-2">No competitors tracked yet</h3>
          <p className="text-sm text-zinc-400 max-w-xs mb-6">
            Add your first competitor using the <span className="text-zinc-600">+</span> button in the sidebar to start monitoring their signals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map((c) => (
            <CompetitorCard key={c.company} competitor={c} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
