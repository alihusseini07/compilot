import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Zap,
  GitCompare,
  Plus,
  Trash2,
  LogOut,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import logo from "../assets/logo.png";
import { cn } from "../lib/utils";
import { useAnalysis } from "../hooks/useAnalysis";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/reports", icon: FileText, label: "Past Reports", end: false },
  { to: "/generate", icon: Zap, label: "Generate", end: false },
  { to: "/compare", icon: GitCompare, label: "Compare", end: false },
];

export default function Layout({
  user,
  token,
  competitors,
  onAddCompetitor,
  onRemoveCompetitor,
  onLogout,
  outletContext,
}) {
  const { analyzing, statusStep, company: analyzingCompany, mode: analyzingMode, error: analysisError, done, steps, progress, dismiss } = useAnalysis();
  const location = useLocation();
  const onGeneratePage = location.pathname.startsWith("/generate");
  const [addOpen, setAddOpen] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [hovered, setHovered] = useState(null);
  const navigate = useNavigate();

  async function handleAdd(e) {
    e.preventDefault();
    if (!newCompany.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      await onAddCompetitor(newCompany.trim(), newDisplayName.trim());
      setNewCompany("");
      setNewDisplayName("");
      setAddOpen(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-zinc-800/70 bg-[#0c0c0e]">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-zinc-800/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 flex-shrink-0">
              <img src={logo} alt="Compilot" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-tight text-zinc-100 font-display">
                Compilot
              </span>
              <span className="block text-[9px] text-zinc-600 font-mono leading-none tracking-[0.15em] uppercase">
                Intelligence Radar
              </span>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150",
                  isActive
                    ? "bg-violet-500/10 text-violet-300 font-medium"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-violet-400" : "text-zinc-600"
                    )}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-zinc-800/50" />

        {/* Competitors list */}
        <div className="flex-1 flex flex-col min-h-0 px-2 py-3">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.15em]">
              Competitors
            </span>
            <button
              onClick={() => setAddOpen(true)}
              className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
              title="Add competitor"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5 min-h-0">
            {competitors.length === 0 ? (
              <p className="text-xs text-zinc-700 px-2 py-1 italic">No competitors saved yet</p>
            ) : (
              competitors.map((c) => (
                <div
                  key={c.company}
                  className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-all"
                  onMouseEnter={() => setHovered(c.company)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => navigate(`/reports/${encodeURIComponent(c.company)}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1 h-1 rounded-full bg-violet-500/50 flex-shrink-0" />
                    <span className="text-xs text-zinc-400 truncate group-hover:text-zinc-200 transition-colors">
                      {c.display_name || c.company}
                    </span>
                  </div>
                  {hovered === c.company && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCompetitor(c.company);
                      }}
                      className="flex-shrink-0 text-zinc-700 hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* User + logout */}
        <div className="px-3 py-3 border-t border-zinc-800/70">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zinc-500 truncate font-mono">{user?.email ?? "—"}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <Outlet context={outletContext} />
      </main>

      {/* ── Analysis Status Widget ── */}
      {!onGeneratePage && (analyzing || done || analysisError) && (
        <div className="fixed bottom-5 right-5 z-50 w-80 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800">
            {analyzing && (
              <span className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin flex-shrink-0" />
            )}
            {done && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
            {analysisError && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
            <span className="flex-1 text-xs font-medium text-zinc-200 truncate">
              {analyzing && `Analyzing ${analyzingCompany}`}
              {done && `${analyzingCompany} — ${analyzingMode} report ready`}
              {analysisError && "Analysis failed"}
            </span>
            <button onClick={dismiss} className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {analyzing && (
              <>
                <p className="text-xs text-zinc-400 mb-2.5">{steps[statusStep]}</p>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-zinc-600 font-mono capitalize">{analyzingMode}</span>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    Step {statusStep + 1}/{steps.length}
                  </span>
                </div>
              </>
            )}
            {done && (
              <button
                onClick={() => {
                  navigate(`/reports/${encodeURIComponent(analyzingCompany)}`);
                  dismiss();
                }}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium"
              >
                View report →
              </button>
            )}
            {analysisError && (
              <p className="text-xs text-red-400">{analysisError}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Add Competitor Dialog ── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setAddOpen(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/50 animate-slide-up">
            <h2 className="text-sm font-semibold text-zinc-100 mb-1 font-display">
              Add Competitor
            </h2>
            <p className="text-xs text-zinc-500 mb-5">
              Start tracking a company's public signals.
            </p>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Company slug
                </label>
                <input
                  className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-all font-mono"
                  placeholder="e.g. linear, notion, figma"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Display name{" "}
                  <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-all"
                  placeholder="e.g. Linear"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                />
              </div>
              {addError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {addError}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !newCompany.trim()}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {adding ? "Adding…" : "Add Competitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
