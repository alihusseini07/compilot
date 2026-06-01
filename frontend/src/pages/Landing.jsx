import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, ChevronDown, ArrowUp, Briefcase, Newspaper,
  Code2, BarChart3, ArrowRight, Check, Zap, Shield, TrendingUp,
} from "lucide-react";
import logo from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";
import { SplineScene } from "../components/ui/splite";
import { EtherealShadow } from "../components/ui/etheral-shadow";

/* ── Model Selector ── */
const MODELS = [
  { id: "deepseek-v3", name: "DeepSeek V3", description: "Best for strategic synthesis" },
  { id: "deepseek-r1", name: "DeepSeek R1", description: "Deeper reasoning, slower" },
  { id: "gpt4o", name: "GPT-4o", description: "Fast, broad knowledge", badge: "Pro" },
];

function ModelSelector({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = MODELS.find((m) => m.id === selected) || MODELS[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-medium transition-colors ${
          open
            ? "bg-zinc-200 text-zinc-800"
            : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        {current.name}
        <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden z-50 p-1.5">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl flex items-start justify-between hover:bg-zinc-50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-zinc-800">{m.name}</span>
                  {m.badge && (
                    <span className="px-1.5 py-px rounded-full text-[10px] font-medium border border-blue-300 text-blue-600 bg-blue-50">
                      {m.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400">{m.description}</span>
              </div>
              {selected === m.id && <Check className="w-3.5 h-3.5 text-blue-500 mt-1" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Chat Input ── */
function ChatInput({ onSend }) {
  const [message, setMessage] = useState("");
  const [model, setModel] = useState("deepseek-v3");
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message.trim(), model);
    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="relative w-full max-w-2xl mx-auto"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
    >
      <div className="flex flex-col mx-2 md:mx-0 rounded-2xl border border-zinc-200 bg-white/90 shadow-lg backdrop-blur-md transition-shadow focus-within:border-zinc-300 focus-within:shadow-xl">
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">
          <div className="min-h-[2.5rem] px-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Which company do you want to track?"
              className="w-full bg-transparent border-0 outline-none text-zinc-800 text-base placeholder:text-zinc-400 resize-none overflow-hidden py-0 leading-relaxed font-normal"
              rows={1}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <ModelSelector selected={model} onSelect={setModel} />
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all active:scale-95 ${
                  message.trim()
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/30"
                    : "bg-blue-200 text-white/60 cursor-default"
                }`}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 bg-white/90 border-2 border-dashed border-blue-400 rounded-2xl z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
          <p className="text-blue-500 font-medium">Drop files to attach</p>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple className="hidden" />
    </div>
  );
}

/* ── Static data ── */
const features = [
  { icon: Briefcase, title: "Jobs Intelligence", description: "Track competitor hiring across Greenhouse, Lever, and LinkedIn. New roles reveal product bets and expansion plans before they go public." },
  { icon: Newspaper, title: "Research Monitor", description: "Catch pricing changes, press releases, and Hacker News mentions in real time. Never miss a strategic move in the market." },
  { icon: Code2, title: "Tech Signals", description: "GitHub commit patterns and patent filings expose R&D direction months before launch. Know what they're building." },
  { icon: BarChart3, title: "Synthesized Reports", description: "AI rolls all signals into daily, weekly, and monthly briefings with confidence scoring — no noise, just signal." },
];

const roles = [
  { title: "Product managers", description: "Validate roadmap decisions with real competitor signals, not guesswork.", preview: "Daily signals\nWeekly trends\nMonthly strategy" },
  { title: "Founders", description: "Know your market moves before your investors ask. Stay one step ahead.", preview: "Pricing changes\nHiring spikes\nR&D direction" },
  { title: "GTM teams", description: "Arm sales with live competitive intel. Win deals with context.", preview: "Battlecards\nLaunch alerts\nThreat scoring" },
];

/* ── Landing ── */
export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleChatSend = (company) => {
    if (isAuthenticated) {
      navigate(`/generate?company=${encodeURIComponent(company)}`);
    } else {
      navigate(`/register?company=${encodeURIComponent(company)}`);
    }
  };

  return (
    <div className="bg-white text-zinc-900 overflow-x-hidden">
      {/* Fixed blue ethereal background */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <EtherealShadow
          color="rgba(59, 130, 246, 0.18)"
          animation={{ scale: 60, speed: 40 }}
          noise={{ opacity: 0.4, scale: 1.2 }}
          sizing="fill"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md">
        <div className="w-full px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Compilot" className="w-7 h-7 object-contain" />
            <span className="font-bold text-sm tracking-tight text-zinc-900">Compilot</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-500">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-900 transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to="/dashboard" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors">
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-3.5 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                  Sign in
                </Link>
                <Link to="/register" className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-0 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-[60%] pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col items-center text-center gap-6 w-full max-w-3xl">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight text-zinc-900">
            What will you{" "}
            <span className="italic text-blue-500">track</span>{" "}
            today?
          </h1>
          <p className="text-lg text-zinc-500 max-w-md">
            AI-powered competitive intelligence — know what competitors build before they announce it.
          </p>

          <div className="w-full max-w-xs h-52 relative">
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          </div>

          <div className="w-full">
            <ChatInput onSend={handleChatSend} />
            <p className="text-xs text-zinc-400 mt-3">
              AI can make mistakes. Always verify strategic conclusions.
            </p>
          </div>
        </div>

        {/* Blue earth arc */}
        <div className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-none overflow-hidden">
          <div
            style={{
              width: "140%",
              height: "420px",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at top, rgba(59,130,246,0.10) 0%, transparent 60%)",
              border: "1px solid rgba(59,130,246,0.15)",
              marginBottom: "-360px",
              boxShadow: "0 -1px 60px rgba(59,130,246,0.08), 0 -1px 0 rgba(59,130,246,0.20)",
            }}
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6 relative">
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-96 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
        />
        <div className="flex flex-col items-center mb-16 relative z-10">
          <div className="w-px h-16 bg-gradient-to-b from-transparent to-blue-400/50" />
          <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_20px_6px_rgba(96,165,250,0.4)]" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            <span className="text-zinc-400">Empowering product teams</span>
            <br />
            <span className="text-zinc-900">with the sharpest intel pipeline</span>
          </h2>
          <p className="text-zinc-500 max-w-lg mx-auto">
            Compilot does the signal collection for you, so you can focus on strategy instead of scrolling LinkedIn.
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-blue-500 font-mono tracking-widest uppercase mb-3">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Every signal that matters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="group p-7 rounded-2xl border border-zinc-200 bg-white/60 hover:border-blue-200 hover:bg-white/80 transition-all shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                  <Icon className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-8 rounded-2xl border border-zinc-200 bg-white/60 shadow-sm flex flex-col items-center justify-center text-center">
            <p className="text-7xl font-bold text-zinc-900 mb-2">3×</p>
            <p className="text-zinc-500 text-sm">faster competitive reviews</p>
            <p className="text-xs text-zinc-400 mt-4 max-w-xs">
              Compilot surfaces insights automatically — no manual monitoring, no spreadsheets.
            </p>
          </div>
          <div className="p-8 rounded-2xl border border-zinc-200 bg-white/60 shadow-sm flex flex-col gap-4">
            {[
              { icon: Zap, color: "text-yellow-500", title: "Real-time scraping", desc: "Jobs, GitHub, news, patents — continuously" },
              { icon: Shield, color: "text-green-500", title: "Isolated agent errors", desc: "One bad source never blocks the full report" },
              { icon: TrendingUp, color: "text-blue-500", title: "Daily → Weekly → Monthly", desc: "Tiered synthesis with confidence scoring" },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                <Icon className={`w-4 h-4 ${color} shrink-0`} />
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{title}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <p className="text-3xl font-bold text-zinc-300">Whatever your role</p>
          </div>
          <div className="text-center mb-16">
            <p className="text-4xl font-bold text-zinc-900">Compilot gives you an edge</p>
            <p className="text-zinc-500 mt-3 max-w-lg mx-auto">
              From idea validation to competitive positioning — adapt the intel to how you work.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map(({ title, description, preview }) => (
              <div key={title} className="p-6 rounded-2xl border border-zinc-200 bg-white/60 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 mb-1">{title}</h3>
                  <p className="text-sm text-zinc-500">{description}</p>
                </div>
                <div className="flex-1 rounded-xl bg-zinc-50 border border-zinc-100 p-4">
                  <pre className="text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap">{preview}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-none overflow-hidden">
          <div
            style={{
              width: "130%",
              height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at top, rgba(59,130,246,0.10) 0%, transparent 60%)",
              border: "1px solid rgba(59,130,246,0.12)",
              marginBottom: "-420px",
              boxShadow: "0 -1px 80px rgba(59,130,246,0.07), 0 -1px 0 rgba(59,130,246,0.15)",
            }}
          />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-left">
            <h2 className="text-3xl font-bold tracking-tight mb-3 text-zinc-900">Ready to track something?</h2>
            <p className="text-zinc-500 text-sm">Try it out — start for free</p>
          </div>
          <div className="flex-1 w-full">
            <ChatInput onSend={handleChatSend} />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-200/60 py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Compilot" className="w-6 h-6 object-contain opacity-60" />
              <span className="font-bold text-sm text-zinc-600">compilot</span>
            </div>
            <p className="text-xs text-zinc-400">Competitive intelligence radar.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Product</p>
            <div className="flex flex-col gap-2 text-sm text-zinc-400">
              <a href="#features" className="hover:text-zinc-700 transition-colors">Features</a>
              <Link to="/register" className="hover:text-zinc-700 transition-colors">Get started</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Company</p>
            <div className="flex flex-col gap-2 text-sm text-zinc-400">
              <a href="#" className="hover:text-zinc-700 transition-colors">About</a>
              <a href="#" className="hover:text-zinc-700 transition-colors">Privacy</a>
              <a href="#" className="hover:text-zinc-700 transition-colors">Terms</a>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Social</p>
            <div className="flex flex-col gap-2 text-sm text-zinc-400">
              <a href="#" className="hover:text-zinc-700 transition-colors">Twitter / X</a>
              <a href="#" className="hover:text-zinc-700 transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-zinc-700 transition-colors">GitHub</a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-zinc-200/60 text-xs text-zinc-400">
          © 2026 Compilot. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
