import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { btnPrimary, field, roleBadgeClass } from "../ui";

const demos = [
  { email: "sarah.okonkwo@harborlane.example", role: "Lead", desc: "Org-wide operations oversight" },
  { email: "marcus.hale@harborlane.example", role: "Manager", desc: "Team & routing manager" },
  { email: "ravi.mehta@harborlane.example", role: "Associate", desc: "Frontline retail operations" },
  { email: "amira.hassan@harborlane.example", role: "Free agent", desc: "Independent associate" },
  { email: "priya.nair@harborlane.example", role: "Admin", desc: "Platform security & users" },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("sarah.okonkwo@harborlane.example");
  const [password, setPassword] = useState("Harborlane!26");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Ambient background glow accents */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold shadow-md shadow-indigo-500/20 text-base">
            ON
          </div>
          <div>
            <div className="text-xs font-bold tracking-[0.22em] text-brand">OPSNINJA</div>
            <div className="text-xs text-muted font-medium">IG Incorporation Operations</div>
          </div>
        </div>

        <h1 className="mt-6 text-xl sm:text-2xl font-bold tracking-tight text-ink">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-muted">
          Turn operational friction into accountable, visible tasks.
        </p>

        {/* Login Form */}
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="block text-xs font-medium text-ink-muted">Work email</label>
            <input
              type="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-ink-muted">Password</label>
              <span className="text-[11px] text-muted">Default: Harborlane!26</span>
            </div>
            <input
              type="password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-due flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          <button disabled={busy} className={`${btnPrimary} w-full py-2.5 font-semibold text-sm`}>
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          Need a new profile?{" "}
          <Link to="/signup" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>

        {/* Quick Demo Accounts Switcher */}
        <div className="mt-7 pt-5 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Demo Quick-Fill
            </span>
            <span className="text-[10px] text-muted">Click any role to load</span>
          </div>
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {demos.map((d) => (
              <button
                key={d.email}
                type="button"
                className={`flex flex-col text-left p-2 rounded-lg border transition-all text-xs cursor-pointer ${
                  email === d.email
                    ? "bg-indigo-50/80 border-indigo-300 shadow-2xs"
                    : "bg-slate-50/80 border-slate-200/70 hover:bg-slate-100 hover:border-slate-300"
                }`}
                onClick={() => setEmail(d.email)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{d.role}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border ${roleBadgeClass(d.role)}`}>
                    Select
                  </span>
                </div>
                <span className="text-[10px] text-muted truncate mt-0.5">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
