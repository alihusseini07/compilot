import { Link } from "react-router-dom";
import { Briefcase, Newspaper, Code2, BarChart3, ArrowRight, CheckCircle2, Zap } from "lucide-react";
import logo from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";

const features = [
  {
    icon: Briefcase,
    title: "Jobs Intelligence",
    description: "Track competitor hiring across Greenhouse, Lever, and LinkedIn. New roles reveal product bets and expansion plans before they're public.",
  },
  {
    icon: Newspaper,
    title: "Research Monitor",
    description: "Catch pricing changes, press releases, and Hacker News mentions in real time. Never miss a strategic move in the market.",
  },
  {
    icon: Code2,
    title: "Tech Signals",
    description: "GitHub commit patterns and patent filings expose R&D direction months before a launch. Know what they're building.",
  },
  {
    icon: BarChart3,
    title: "Synthesized Reports",
    description: "AI rolls all signals into daily, weekly, and monthly briefings with confidence scoring — no noise, just signal.",
  },
];

const bullets = [
  "Multi-source scraping across jobs, news, GitHub, and patents",
  "LLM synthesis into actionable strategic conclusions",
  "Daily, weekly, and monthly report cadences",
  "Confidence scoring on every insight",
];

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 dot-grid text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10">
              <img src={logo} alt="Compilot" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm text-zinc-100 tracking-tight">Compilot</span>
            <span className="text-xs text-zinc-600 font-mono tracking-widest uppercase hidden sm:block ml-1">
              Intelligence Radar
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
              >
                Go to dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
                >
                  Get started <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-xs text-violet-400 font-mono mb-6">
            <Zap className="w-3 h-3" />
            Competitive intelligence, automated
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-5">
            Know what competitors{" "}
            <span className="text-violet-400">are building</span>
            <br />
            before they announce it
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Compilot monitors job postings, news, GitHub, and patents — then uses AI to surface strategic signals in a daily intelligence briefing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-all shadow-lg shadow-violet-500/20"
              >
                Go to dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-all shadow-lg shadow-violet-500/20"
                >
                  Get started free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3 rounded-xl border border-zinc-700 hover:border-zinc-600 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-all"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Every signal that matters
          </h2>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Four data streams. One unified intelligence layer.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-violet-500/30 hover:bg-zinc-900/60 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/15 transition-colors">
                <Icon className="w-4.5 h-4.5 text-violet-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-100 mb-2">{title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
              Built for founders and<br />
              <span className="text-violet-400">product strategists</span>
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              Stop reading TC articles after the fact. Compilot gives you the signal before the press release — so you can move first.
            </p>
            <ul className="space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-zinc-400">
                  <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Mini report preview */}
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500/5 rounded-3xl blur-2xl" />
            <div className="relative bg-zinc-900/80 border border-zinc-700/60 rounded-2xl p-5 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-zinc-500">Daily Report — Linear</span>
                <span className="text-violet-400 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">HIGH CONFIDENCE</span>
              </div>
              <div className="space-y-2 text-zinc-300 leading-relaxed">
                <p>
                  <span className="text-violet-400">→</span> 4 new backend engineer roles opened in ML infra team. Combined with 3 patent filings around AI scheduling, suggests a native automation feature in Q3.
                </p>
                <p>
                  <span className="text-violet-400">→</span> Pricing page quietly removed the "Teams" tier. GitHub issue activity on SSO module up 3× this week.
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-800 text-zinc-600 text-[10px]">
                Jobs · Research · Tech · 12 signals processed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800/60">
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Start tracking your competitors today
          </h2>
          <p className="text-zinc-500 text-sm mb-8">
            Set up in minutes. Get your first daily report tonight.
          </p>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-all shadow-lg shadow-violet-500/20"
            >
              Go to dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white transition-all shadow-lg shadow-violet-500/20"
            >
              Create free account <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Compilot" className="w-3.5 h-3.5 object-contain opacity-40" />
            <span>Compilot — Intelligence Radar</span>
          </div>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
