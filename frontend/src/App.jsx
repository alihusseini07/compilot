import { useState, useCallback } from "react";
import RadarDashboard from "./components/RadarDashboard.jsx";
import SignalFeed from "./components/SignalFeed.jsx";
import InferenceCard from "./components/InferenceCard.jsx";

const API = "/api";

export default function App() {
  const [company, setCompany] = useState("");
  const [submittedCompany, setSubmittedCompany] = useState(null);
  const [signals, setSignals] = useState([]);
  const [inferences, setInferences] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const runPipeline = useCallback(async () => {
    if (!company.trim()) return;
    setLoading(true);
    setStatus("Running scrapers...");

    try {
      await fetch(`${API}/run-scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.toLowerCase() }),
      });

      setStatus("Synthesizing with Claude...");
      await fetch(`${API}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.toLowerCase() }),
      });

      setStatus("Fetching results...");
      const [sigResp, infResp] = await Promise.all([
        fetch(`${API}/signals/${company.toLowerCase()}`),
        fetch(`${API}/inferences/${company.toLowerCase()}`),
      ]);
      const sigData = await sigResp.json();
      const infData = await infResp.json();

      setSignals(sigData.signals || []);
      setInferences(infData.inferences || []);
      setSubmittedCompany(company);
      setStatus("Done.");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [company]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "Inter, sans-serif", padding: "2rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc", marginBottom: "0.25rem" }}>
          Compilot
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
          Competitive intelligence radar — infer strategy before it's announced.
        </p>
      </header>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
        <input
          type="text"
          placeholder="Enter competitor name (e.g. linear)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runPipeline()}
          style={{
            flex: 1,
            padding: "0.6rem 1rem",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#f8fafc",
            fontSize: "0.95rem",
          }}
        />
        <button
          onClick={runPipeline}
          disabled={loading || !company.trim()}
          style={{
            padding: "0.6rem 1.5rem",
            borderRadius: "8px",
            background: loading ? "#334155" : "#6366f1",
            color: "#fff",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Running..." : "Analyze"}
        </button>
      </div>

      {status && (
        <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.85rem" }}>{status}</p>
      )}

      {submittedCompany && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "1rem" }}>
              Signal Radar — {submittedCompany}
            </h2>
            <RadarDashboard signals={signals} />
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#cbd5e1", margin: "1.5rem 0 1rem" }}>
              Raw Signals
            </h2>
            <SignalFeed signals={signals} />
          </div>

          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "1rem" }}>
              AI Inferences ({inferences.length})
            </h2>
            {inferences.map((inf) => (
              <InferenceCard key={inf.id} inference={inf} signals={signals} />
            ))}
            {inferences.length === 0 && (
              <p style={{ color: "#475569", fontSize: "0.85rem" }}>No inferences yet. Run analysis first.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
