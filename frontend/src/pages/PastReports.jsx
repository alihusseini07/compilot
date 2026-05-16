import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import ReportCard from "../components/ReportCard";
import { fetchLatest, fetchHistory } from "../hooks/useReports";

const TABS = ["daily", "weekly", "monthly"];
const HISTORY_LIMITS = { daily: 7, weekly: 4, monthly: 3 };

export default function PastReports({ competitors }) {
  const { company: paramCompany } = useParams();
  const navigate = useNavigate();

  const [selectedCompany, setSelectedCompany] = useState(paramCompany ?? "");
  const [activeTab, setActiveTab] = useState("daily");
  const [latestReport, setLatestReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const slug = selectedCompany.trim().toLowerCase();

  const loadData = useCallback(async (company, type) => {
    if (!company) return;
    setLoading(true);
    setError("");
    try {
      const [latest, hist] = await Promise.all([
        fetchLatest(company),
        fetchHistory(company, type, HISTORY_LIMITS[type]),
      ]);
      setLatestReport(latest[type] ?? null);
      setHistory(hist.filter((r) => r.id !== (latest[type]?.id)));
    } catch (err) {
      setError(err.message);
      setLatestReport(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (slug) loadData(slug, activeTab);
  }, [slug, activeTab, loadData]);

  useEffect(() => {
    if (paramCompany) setSelectedCompany(paramCompany);
  }, [paramCompany]);

  function handleSelectCompany(company) {
    setSelectedCompany(company);
    setDropdownOpen(false);
    navigate(`/reports/${encodeURIComponent(company)}`, { replace: true });
  }

  const allReports = latestReport
    ? [latestReport, ...history]
    : history;

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 font-display tracking-tight">
          Past Reports
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Historical intelligence reports for tracked competitors.
        </p>
      </div>

      {/* Company selector */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <button
            onClick={() => setDropdownOpen((p) => !p)}
            className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 hover:border-zinc-600 transition-all"
          >
            <span className={slug ? "text-zinc-200 font-mono" : "text-zinc-600"}>
              {slug || "Select a competitor…"}
            </span>
            <ChevronDown className="w-4 h-4 text-zinc-600 flex-shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in">
              {competitors.length === 0 ? (
                <p className="text-xs text-zinc-600 px-4 py-3 italic">No competitors saved</p>
              ) : (
                competitors.map((c) => (
                  <button
                    key={c.company}
                    onClick={() => handleSelectCompany(c.company)}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors font-mono"
                  >
                    {c.display_name || c.company}
                  </button>
                ))
              )}
              {/* Manual input option */}
              <div className="border-t border-zinc-800 px-3 py-2">
                <input
                  className="w-full bg-zinc-800/80 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono"
                  placeholder="Type company name…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      handleSelectCompany(e.target.value.trim().toLowerCase());
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </div>

        {slug && (
          <button
            onClick={() => loadData(slug, activeTab)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize",
              activeTab === tab
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {!slug ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-sm">Select a competitor above to view their reports.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8">
          <span className="w-4 h-4 border border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
          Loading {activeTab} reports for <span className="font-mono text-zinc-300">{slug}</span>…
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : allReports.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="text-sm">
            No {activeTab} reports yet for{" "}
            <span className="font-mono text-zinc-400">{slug}</span>.
          </p>
          <p className="text-xs mt-1">
            Go to{" "}
            <button
              onClick={() => navigate(`/generate/${encodeURIComponent(slug)}`)}
              className="text-violet-400 hover:underline"
            >
              Generate
            </button>{" "}
            to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allReports.map((report, i) => (
            <ReportCard
              key={report.id}
              report={report}
              type={activeTab}
              isLatest={i === 0}
              history={allReports}
            />
          ))}
        </div>
      )}
    </div>
  );
}
