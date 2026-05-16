import { useState, useRef } from "react";
import ReportCard from "./components/ReportCard";
import HistoryList from "./components/HistoryList";
import "./index.css";

const TABS = ["daily", "weekly", "monthly"];
const HISTORY_LIMITS = { daily: 7, weekly: 4, monthly: 3 };
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 900000; // 15 min — LLM calls are slow

const STATUS_STEPS = {
  daily: [
    "Queuing analysis…",
    "Running jobs, research & tech agents…",
    "Scraping data sources…",
    "Calling LLM for domain conclusions…",
    "Daily synthesis agent reasoning…",
    "Writing report to database…",
  ],
  weekly: [
    "Queuing analysis…",
    "Checking daily report history…",
    "Running weekly synthesis…",
    "Writing report to database…",
  ],
  monthly: [
    "Queuing analysis…",
    "Checking weekly report history…",
    "Running monthly synthesis…",
    "Writing report to database…",
  ],
};

const STEP_INTERVAL = { daily: 18000, weekly: 25000, monthly: 25000 };

async function fetchLatest(company) {
  const res = await fetch(`/reports/${encodeURIComponent(company)}/latest`);
  if (!res.ok) throw new Error("fetch latest failed");
  return res.json();
}

async function fetchHistory(company, type) {
  const limit = HISTORY_LIMITS[type];
  const res = await fetch(`/reports/${encodeURIComponent(company)}/${type}?limit=${limit}`);
  if (!res.ok) throw new Error(`fetch ${type} history failed`);
  const data = await res.json();
  return data.reports || [];
}

export default function App() {
  const [company, setCompany] = useState("");
  const [activeTab, setActiveTab] = useState("daily");
  const [analyzing, setAnalyzing] = useState(null); // null | "daily" | "weekly" | "monthly"
  const [statusStep, setStatusStep] = useState(0);
  const [latestReports, setLatestReports] = useState({ daily: null, weekly: null, monthly: null });
  const [history, setHistory] = useState({ daily: [], weekly: [], monthly: [] });
  const [loadedTabs, setLoadedTabs] = useState({ daily: false, weekly: false, monthly: false });
  const [errors, setErrors] = useState({ daily: null, weekly: null, monthly: null });
  const pollRef = useRef(null);
  const stepRef = useRef(null);

  const slug = company.trim().toLowerCase();

  function dropFirst(arr, latest) {
    return arr.filter(r => !latest || r.id !== latest.id);
  }

  async function loadTab(co, tab) {
    const [latest, hist] = await Promise.all([
      fetchLatest(co),
      fetchHistory(co, tab),
    ]);
    setLatestReports(prev => ({ ...prev, [tab]: latest[tab] }));
    setHistory(prev => ({ ...prev, [tab]: dropFirst(hist, latest[tab]) }));
    setLoadedTabs(prev => ({ ...prev, [tab]: true }));
  }

  async function handleTabSwitch(tab) {
    setActiveTab(tab);
    if (loadedTabs[tab] || !slug) return;
    try { await loadTab(slug, tab); } catch { /* silent */ }
  }

  async function handleLoadCompany() {
    if (!slug) return;
    try { await loadTab(slug, activeTab); } catch { /* silent */ }
  }

  async function handleAnalyze(mode) {
    if (!slug || analyzing) return;
    setErrors(prev => ({ ...prev, [mode]: null }));
    setAnalyzing(mode);
    setStatusStep(0);

    const preClickTime = Date.now();
    const steps = STATUS_STEPS[mode];

    let step = 0;
    stepRef.current = setInterval(() => {
      step = Math.min(step + 1, steps.length - 1);
      setStatusStep(step);
    }, STEP_INTERVAL[mode]);

    try {
      const res = await fetch(`/analyze/${encodeURIComponent(slug)}?mode=${mode}`, {
        method: "POST",
      });
      if (res.status === 422) {
        const body = await res.json();
        throw new Error(body.detail || "Not enough data to generate this report.");
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      await new Promise((resolve, reject) => {
        const deadline = Date.now() + POLL_TIMEOUT;
        pollRef.current = setInterval(async () => {
          if (Date.now() > deadline) {
            clearInterval(pollRef.current);
            reject(new Error(
              "Still processing — the report will appear when done. " +
              "Refresh the tab to check for results."
            ));
            return;
          }
          try {
            const data = await fetchLatest(slug);
            const report = data[mode];
            if (report && new Date(report.created_at).getTime() > preClickTime) {
              clearInterval(pollRef.current);
              resolve();
            }
          } catch { /* keep polling */ }
        }, POLL_INTERVAL);
      });

      await loadTab(slug, mode);
    } catch (e) {
      setErrors(prev => ({ ...prev, [mode]: e.message }));
    } finally {
      clearInterval(stepRef.current);
      setAnalyzing(null);
    }
  }

  async function handleRefreshTab(tab) {
    if (!slug) return;
    try { await loadTab(slug, tab); } catch { /* silent */ }
  }

  const currentLatest = latestReports[activeTab];
  const currentHistory = history[activeTab];
  const hasAny = currentLatest || (currentHistory && currentHistory.length > 0);
  const isAnalyzingThis = analyzing === activeTab;
  const tabError = errors[activeTab];
  const steps = STATUS_STEPS[activeTab];

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">C</div>
        <h1>Compilot</h1>
        <p>Competitive Intelligence Radar</p>
      </header>

      <div className="input-row">
        <input
          className="company-input"
          type="text"
          placeholder="Company name (e.g. linear, notion, figma)"
          value={company}
          onChange={e => setCompany(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLoadCompany()}
          disabled={!!analyzing}
        />
      </div>

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? " active" : ""}`}
            onClick={() => handleTabSwitch(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {analyzing === tab && <span className="tab-spinner" />}
          </button>
        ))}
        <div className="tab-spacer" />
        <button
          className="analyze-btn"
          onClick={() => handleAnalyze(activeTab)}
          disabled={!slug || !!analyzing}
        >
          {isAnalyzingThis && <span className="spinner" />}
          {isAnalyzingThis
            ? "Analyzing…"
            : `Analyze ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </button>
      </nav>

      {isAnalyzingThis && (
        <div className="status-bar">
          <span className="spinner" />
          {steps[statusStep]}
        </div>
      )}

      {tabError && (
        <div className="status-bar status-bar-warn">
          ⚠ {tabError}
          <button className="refresh-btn" onClick={() => handleRefreshTab(activeTab)}>
            Refresh
          </button>
        </div>
      )}

      {!slug ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>⬆</div>
          <p>Enter a company name and press Enter to load, or hit Analyze to run.</p>
        </div>
      ) : !hasAny && !isAnalyzingThis ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
          <p>No {activeTab} report yet for <strong>{slug}</strong>.</p>
          <p style={{ marginTop: 6 }}>
            Click <strong>Analyze {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong> to generate one.
          </p>
        </div>
      ) : (
        <>
          {currentLatest && (
            <ReportCard report={currentLatest} type={activeTab} isLatest />
          )}
          <HistoryList reports={currentHistory} type={activeTab} />
        </>
      )}
    </div>
  );
}
