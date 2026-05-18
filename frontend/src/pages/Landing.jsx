import { Link } from "react-router-dom";
import { Briefcase, Newspaper, Code2, BarChart3, ArrowRight, ChevronDown } from "lucide-react";
import logo from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";
import { SplineScene } from "../components/ui/splite";
import { Spotlight } from "../components/ui/spotlight";

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

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="bg-zinc-950 dot-grid text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8">
              <img src={logo} alt="Compilot" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm text-zinc-100 tracking-tight">Compilot</span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-sm font-medium text-white transition-colors"
              >
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-sm font-medium text-white transition-colors"
                >
                  Get started <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* PAGE 1 — Logo + tagline */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] bg-blue-700/8 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col items-center gap-6">
          <img src={logo} alt="Compilot" className="w-24 h-24 object-contain" />
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight">
            Compilot
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-sm">
            Know what your competitors are building — before they announce it.
          </p>
          <div className="flex items-center gap-3 mt-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-700/25"
              >
                Go to dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-700/25"
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
        <div className="absolute bottom-10 flex flex-col items-center gap-1 text-zinc-600 animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* PAGE 2 — Robot + what it does */}
      <section className="min-h-screen flex items-center px-6 relative overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />
        <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center gap-12 py-24">
          {/* Right: Spline robot — shown first on mobile via order */}
          <div className="flex-1 h-[480px] w-full relative order-1 md:order-2">
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          </div>
          {/* Left: copy */}
          <div className="flex-1 relative z-10 order-2 md:order-1">
            <p className="text-xs text-sky-400 font-mono tracking-widest uppercase mb-4">How it works</p>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-6">
              Your AI-powered<br />
              <span className="text-sky-400">intelligence analyst</span>
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              Compilot watches your competitors across jobs, GitHub, patents, and news — 24/7. Its AI reasons across every signal to surface strategic conclusions, not just raw data.
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Daily briefings. Weekly trends. Monthly strategy reports. All automatically — so you can focus on building.
            </p>
          </div>
        </div>
      </section>

      {/* PAGE 3 — Core features */}
      <section className="min-h-screen flex flex-col justify-center px-6 py-24 border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <p className="text-xs text-sky-400 font-mono tracking-widest uppercase mb-3">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Every signal that matters
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group p-7 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-sky-400/30 hover:bg-zinc-900/60 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center mb-5 group-hover:bg-sky-400/15 transition-colors">
                  <Icon className="w-5 h-5 text-sky-400" />
                </div>
                <h3 className="font-semibold text-zinc-100 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-16">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-700/25"
              >
                Go to dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-sm font-semibold text-white transition-all shadow-lg shadow-blue-700/25"
              >
                Start for free <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
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
