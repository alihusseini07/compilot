import { useState, useRef } from "react";
import ReportCard from "./components/ReportCard";
import HistoryList from "./components/HistoryList";
import "./index.css";

const TABS = ["daily", "weekly", "monthly"];
const HISTORY_LIMITS = { daily: 7, weekly: 4, monthly: 3 };
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 600000;

const STATUS_STEPS = [
  "Queuing analysis…",
  "Running jobs, research & tech agents…",
  "Agents scraping data sources…",
  "Calling LLM for domain conclusions…",
  "Daily synthesis agent reasoning…",
  "Writing report to database…",
];

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
  const [analyzing, setAnalyzing] = useState(false);
  const [statusStep, setStatusStep] = useState(0);
  const [latestReports, setLatestReports] = useState({ daily: null, weekly: null, monthly: null });
  const [history, setHistory] = useState({ daily: [], weekly: [], monthly: [] });
  const [loadedTabs, setLoadedTabs] = useState({ daily: false, weekly: false, monthly: false });
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const stepRef = useRef(null);

  const slug = company.trim().toLowerCase();

  function dropFirst(arr, latest) {
    return arr.filter(r => !latest || r.id !== latest.id);
  }

  async function loadAll(co) {
    const [latest, dailyH, weeklyH, monthlyH] = await Promise.all([
      fetchLatest(co),
      fetchHistory(co, "daily"),
      fetchHistory(co, "weekly"),
      fetchHistory(co, "monthly"),
    ]);
    setLatestReports({ daily: latest.daily, weekly: latest.weekly, monthly: latest.monthly });
    setHistory({
      daily: dropFirst(dailyH, latest.daily),
      weekly: dropFirst(weeklyH, latest.weekly),
      monthly: dropFirst(monthlyH, latest.monthly),
    });
    setLoadedTabs({ daily: true, weekly: true, monthly: true });
  }

  async function handleTabSwitch(tab) {
    setActiveTab(tab);
    if (loadedTabs[tab] || !slug) return;
    try {
      const [latest, hist] = await Promise.all([
        fetchLatest(slug),
        fetchHistory(slug, tab),
      ]);
      setLatestReports(prev => ({ ...prev, [tab]: latest[tab] }));
      setHistory(prev => ({
        ...prev,
        [tab]: dropFirst(hist, latest[tab]),
      }));
      setLoadedTabs(prev => ({ ...prev, [tab]: true }));
    } catch { /* silent */ }
  }

  async function handleAnalyze() {
    if (!slug || analyzing) return;
    setError(null);
    setAnalyzing(true);
    setStatusStep(0);

    const preClickTime = Date.now();

    let step = 0;
    stepRef.current = setInterval(() => {
      step = Math.min(step + 1, STATUS_STEPS.length - 1);
      setStatusStep(step);
    }, 18000);

    try {
      const res = await fetch(`/analyze/${encodeURIComponent(slug)}?mode=daily`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Analyze request failed (${res.status})`);

      await new Promise((resolve, reject) => {
        const deadline = Date.now() + POLL_TIMEOUT;
        pollRef.current = setInterval(async () => {
          if (Date.now() > deadline) {
            clearInterval(pollRef.current);
            reject(new Error("Timed out waiting for report — worker may still be running"));
            return;
          }
          try {
            const data = await fetchLatest(slug);
            if (data.daily && new Date(data.daily.created_at).getTime() > preClickTime) {
              clearInterval(pollRef.current);
              resolve();
            }
          } catch { /* keep polling */ }
        }, POLL_INTERVAL);
      });

      await loadAll(slug);
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(stepRef.current);
      setAnalyzing(false);
    }
  }

  const currentLatest = latestReports[activeTab];
  const currentHistory = history[activeTab];
  const hasAny = currentLatest || (currentHistory && currentHistory.length > 0);

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
          onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          disabled={analyzing}
        />
        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={!slug || analyzing}
        >
          {analyzing && <span className="spinner" />}
          {analyzing ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {analyzing && (
        <div className="status-bar">
          <span className="spinner" />
          {STATUS_STEPS[statusStep]}
        </div>
      )}

      {error && (
        <div className="status-bar" style={{ borderColor: "#f9731630", color: "#fb923c" }}>
          ⚠ {error}
        </div>
      )}

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? " active" : ""}`}
            onClick={() => handleTabSwitch(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {!slug ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>⬆</div>
          <p>Enter a company name above to start.</p>
        </div>
      ) : !hasAny && !analyzing ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
          <p>No {activeTab} report yet for <strong>{slug}</strong>.</p>
          <p style={{ marginTop: 6 }}>Click Analyze to generate one.</p>
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
