import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import ReportCard from "../components/ReportCard";
import { fetchLatest, fetchHistory } from "../hooks/useReports";

const TABS = ["daily", "weekly", "monthly"];
const HISTORY_LIMITS = { daily: 7, weekly: 4, monthly: 3 };

function CompanyPicker({ value, onChange, competitors, placeholder }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm hover:border-zinc-600 transition-all"
      >
        <span className={value ? "text-zinc-200 font-mono" : "text-zinc-600"}>
          {value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-zinc-600 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in">
          {competitors.map((c) => (
            <button
              key={c.company}
              onClick={() => {
                onChange(c.company);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors font-mono"
            >
              {c.display_name || c.company}
            </button>
          ))}
          <div className="border-t border-zinc-800 px-3 py-2">
            <input
              className="w-full bg-zinc-800/80 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 font-mono"
              placeholder="Type a name…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  onChange(e.target.value.trim().toLowerCase());
                  setOpen(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyColumn({ company, activeTab }) {
  const [latestReport, setLatestReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    Promise.all([
      fetchLatest(company),
      fetchHistory(company, activeTab, HISTORY_LIMITS[activeTab]),
    ])
      .then(([latest, hist]) => {
        setLatestReport(latest[activeTab] ?? null);
        setHistory(hist.filter((r) => r.id !== (latest[activeTab]?.id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company, activeTab]);

  if (!company) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-zinc-700 text-sm">
        Select a competitor above
      </div>
    );
  }

  const allReports = latestReport ? [latestReport, ...history] : history;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-zinc-200 font-mono">{company}</h3>
        <span className="text-[10px] font-mono text-zinc-600 uppercase">{activeTab}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-600 py-4">
          <span className="w-3 h-3 border border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          Loading…
        </div>
      ) : allReports.length === 0 ? (
        <p className="text-sm text-zinc-700 italic">
          No {activeTab} reports for <span className="font-mono text-zinc-500">{company}</span>.
        </p>
      ) : (
        <div className="space-y-3">
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

export default function Compare({ competitors }) {
  const [companyA, setCompanyA] = useState("");
  const [companyB, setCompanyB] = useState("");
  const [activeTab, setActiveTab] = useState("daily");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 font-display tracking-tight">Compare</h1>
        <p className="text-sm text-zinc-500 mt-1">
          View two competitors' reports side by side.
        </p>
      </div>

      {/* Pickers */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-2xl">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Company A</label>
          <CompanyPicker
            value={companyA}
            onChange={setCompanyA}
            competitors={competitors}
            placeholder="Select first competitor…"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Company B</label>
          <CompanyPicker
            value={companyB}
            onChange={setCompanyB}
            competitors={competitors}
            placeholder="Select second competitor…"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit">
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

      {/* Side by side */}
      <div className="flex gap-6">
        <CompanyColumn company={companyA} activeTab={activeTab} />
        <div className="w-px bg-zinc-800 flex-shrink-0" />
        <CompanyColumn company={companyB} activeTab={activeTab} />
      </div>
    </div>
  );
}
