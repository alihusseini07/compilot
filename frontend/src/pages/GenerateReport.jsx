import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Zap, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { useAnalysis, STATUS_STEPS } from "../hooks/useAnalysis";
import { useAuth } from "../hooks/useAuth";

const TABS = ["daily", "weekly", "monthly"];

export default function GenerateReport({ competitors }) {
  const { company: paramCompany } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { analyzing, statusStep, company: analyzingCompany, mode: analyzingMode, done, dismiss, startAnalysis, steps, progress } = useAnalysis();

  const [selectedCompany, setSelectedCompany] = useState(paramCompany ?? "");
  const [activeTab, setActiveTab] = useState("daily");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (paramCompany) setSelectedCompany(paramCompany);
  }, [paramCompany]);

  // Auto-navigate when done and user is on this page
  useEffect(() => {
    if (done && analyzingCompany) {
      dismiss();
      navigate(`/reports/${encodeURIComponent(analyzingCompany)}`);
    }
  }, [done]);

  const slug = selectedCompany.trim().toLowerCase();
  const currentSteps = STATUS_STEPS[analyzingMode] || STATUS_STEPS[activeTab];
  const currentProgress = analyzing ? ((statusStep + 1) / currentSteps.length) * 100 : 0;

  async function handleAnalyze() {
    if (!slug || analyzing) return;
    await startAnalysis(slug, activeTab, token, activeTab === "daily" ? selectedDate : undefined);
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 font-display tracking-tight">
          Generate Report
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Trigger the AI agent pipeline for a competitor.
        </p>
      </div>

      {/* Company selector */}
      <div className="mb-6">
        <label className="block text-xs text-zinc-400 mb-2">Competitor</label>
        <div className="relative max-w-xs">
          <button
            onClick={() => !analyzing && setDropdownOpen((p) => !p)}
            disabled={analyzing}
            className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 hover:border-zinc-600 transition-all disabled:opacity-50"
          >
            <span className={slug ? "text-zinc-200 font-mono" : "text-zinc-600"}>
              {slug || "Select a competitor…"}
            </span>
            <ChevronDown className="w-4 h-4 text-zinc-600 flex-shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in">
              {competitors.map((c) => (
                <button
                  key={c.company}
                  onClick={() => {
                    setSelectedCompany(c.company);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors font-mono"
                >
                  {c.display_name || c.company}
                </button>
              ))}
              <div className="border-t border-zinc-800 px-3 py-2">
                <input
                  className="w-full bg-zinc-800/80 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 font-mono"
                  placeholder="Or type a company name…"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualInput.trim()) {
                      setSelectedCompany(manualInput.trim().toLowerCase());
                      setManualInput("");
                      setDropdownOpen(false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report type tabs */}
      <div className="mb-8">
        <label className="block text-xs text-zinc-400 mb-2">Report type</label>
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => !analyzing && setActiveTab(tab)}
              disabled={analyzing}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize",
                activeTab === tab
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-400 disabled:pointer-events-none"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-3 text-xs text-zinc-600 space-y-1">
          {activeTab === "weekly" && (
            <p className="flex items-center gap-1.5 text-amber-500/80">
              <span className="w-1 h-1 rounded-full bg-amber-500/80 flex-shrink-0" />
              Requires 7 daily reports to exist.
            </p>
          )}
          {activeTab === "monthly" && (
            <p className="flex items-center gap-1.5 text-amber-500/80">
              <span className="w-1 h-1 rounded-full bg-amber-500/80 flex-shrink-0" />
              Requires 4 weekly reports to exist.
            </p>
          )}
        </div>
      </div>

      {/* Date picker — daily only */}
      {activeTab === "daily" && (
        <div className="mb-8">
          <label className="block text-xs text-zinc-400 mb-2">Report date</label>
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={analyzing}
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 hover:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-50 [color-scheme:dark]"
          />
        </div>
      )}

      {/* Progress — show whenever any analysis is running */}
      {analyzing && (
        <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 border border-zinc-700 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm text-zinc-300">{currentSteps[statusStep]}</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-full transition-all duration-1000"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-zinc-700 font-mono capitalize">
              {analyzingCompany} · {analyzingMode}
            </span>
            <span className="text-[10px] text-zinc-700 font-mono">
              Step {statusStep + 1} of {currentSteps.length}
            </span>
          </div>
        </div>
      )}

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={!slug || analyzing}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-700/10 hover:shadow-blue-700/20"
      >
        {analyzing ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing {analyzingCompany}…
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Analyze {activeTab}
            {slug ? (
              <span className="font-mono font-normal text-white/70 ml-1">({slug})</span>
            ) : null}
          </>
        )}
      </button>

      {!analyzing && (
        <p className="text-xs text-zinc-700 mt-3">
          Analysis runs in the background via Celery. Daily reports take ~3–5 min.
        </p>
      )}
    </div>
  );
}
