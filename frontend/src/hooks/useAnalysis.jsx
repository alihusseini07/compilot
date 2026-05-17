import { createContext, useContext, useRef, useState } from "react";
import { fetchLatest, triggerAnalysis } from "./useReports";

const AnalysisContext = createContext(null);

export const STATUS_STEPS = {
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
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 900000;

export function AnalysisProvider({ children }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [statusStep, setStatusStep] = useState(0);
  const [company, setCompany] = useState("");
  const [mode, setMode] = useState("daily");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const pollRef = useRef(null);
  const stepRef = useRef(null);

  async function startAnalysis(slug, activeTab, token, date) {
    if (analyzing) return;
    clearInterval(pollRef.current);
    clearInterval(stepRef.current);

    setError("");
    setDone(false);
    setAnalyzing(true);
    setStatusStep(0);
    setCompany(slug);
    setMode(activeTab);

    const preClickTime = Date.now();
    const steps = STATUS_STEPS[activeTab];
    let step = 0;

    stepRef.current = setInterval(() => {
      step = Math.min(step + 1, steps.length - 1);
      setStatusStep(step);
    }, STEP_INTERVAL[activeTab]);

    try {
      await triggerAnalysis(slug, activeTab, token, date);

      await new Promise((resolve, reject) => {
        const deadline = Date.now() + POLL_TIMEOUT;
        pollRef.current = setInterval(async () => {
          if (Date.now() > deadline) {
            clearInterval(pollRef.current);
            reject(new Error("Analysis timed out — check Past Reports in a moment."));
            return;
          }
          try {
            const data = await fetchLatest(slug);
            const report = data[activeTab];
            if (report && new Date(report.created_at).getTime() > preClickTime) {
              clearInterval(pollRef.current);
              resolve();
            }
          } catch { /* keep polling */ }
        }, POLL_INTERVAL);
      });

      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(stepRef.current);
      setAnalyzing(false);
    }
  }

  function dismiss() {
    setError("");
    setDone(false);
    setCompany("");
  }

  const steps = STATUS_STEPS[mode] || STATUS_STEPS.daily;
  const progress = analyzing ? ((statusStep + 1) / steps.length) * 100 : 0;

  return (
    <AnalysisContext.Provider
      value={{ analyzing, statusStep, company, mode, error, done, steps, progress, startAnalysis, dismiss }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}
