import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import logo from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";
import { EtherealShadow } from "../components/ui/etheral-shadow";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validate() {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError("");
    try {
      await register(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <EtherealShadow
          color="rgba(59, 130, 246, 0.18)"
          animation={{ scale: 60, speed: 40 }}
          noise={{ opacity: 0.4, scale: 1.2 }}
          sizing="fill"
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16">
              <img src={logo} alt="Compilot" className="w-full h-full object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-zinc-900 font-display tracking-tight">Compilot</h1>
              <p className="text-xs text-zinc-400 font-mono tracking-widest uppercase">Intelligence Radar</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm border border-zinc-200 rounded-2xl p-7 shadow-xl shadow-zinc-200/60">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1 font-display">Create account</h2>
          <p className="text-xs text-zinc-500 mb-6">Start monitoring your competitive landscape.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-600 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-600 mb-1.5">Confirm password</label>
              <input
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                required
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || !confirm}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </>
              ) : (
                <>Create account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-xs text-zinc-400 text-center mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-500 hover:text-blue-600 transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
