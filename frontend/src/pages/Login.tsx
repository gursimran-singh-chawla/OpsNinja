import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { ApiError } from "../api";
import { btnPrimary, field, roleBadgeClass } from "../ui";

const demos = [
  { email: "sarah.okonkwo@harborlane.example", role: "Lead", desc: "Org-wide operations oversight" },
  { email: "marcus.hale@harborlane.example", role: "Manager", desc: "Team & routing manager" },
  { email: "ravi.mehta@harborlane.example", role: "Associate", desc: "Frontline operations" },
  { email: "amira.hassan@harborlane.example", role: "Free agent", desc: "Independent associate" },
  { email: "priya.nair@harborlane.example", role: "Admin", desc: "Platform security & users" },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("sarah.okonkwo@harborlane.example");
  const [password, setPassword] = useState("Harborlane!26");
  const [error, setError] = useState<string | null>(null);
  const [notVerifiedEmail, setNotVerifiedEmail] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotVerifiedEmail(null);
    setPendingApproval(false);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_not_verified") {
        setNotVerifiedEmail(email);
        setError("Your email is not verified yet.");
      } else if (err instanceof ApiError && err.code === "account_pending_approval") {
        setPendingApproval(true);
        setError(err.message || "Your account is waiting for administrator approval and will be available to log in in some time once approved.");
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
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

          {pendingApproval && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-amber-950">
                <span className="text-sm">⏳</span>
                <span>Account Waiting Approval</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Your account is waiting for administrator approval and will be available to log in in some time once approved.
              </p>
            </div>
          )}

          {!pendingApproval && error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-due space-y-2">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span className="font-medium">{error}</span>
              </div>
              {notVerifiedEmail && (
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-rose-800">Please verify your email before signing in.</span>
                  <Link
                    to={`/verify-email?email=${encodeURIComponent(notVerifiedEmail)}`}
                    className="inline-flex items-center gap-1 font-semibold text-brand hover:underline bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-xs shadow-2xs"
                  >
                    Verify email →
                  </Link>
                </div>
              )}
            </div>
          )}

          <button disabled={busy} className={`${btnPrimary} w-full py-2.5 font-semibold text-sm`}>
            {busy ? (
              <span className="flex items-center justify-center gap-2">
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

        {/* Quick Demo Switcher */}
        <div className="mt-8 border-t border-border/80 pt-5">
          <div className="flex items-center justify-between text-xs text-muted mb-3">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Quick Demo Switcher</span>
            <span className="text-[10px]">Click any persona</span>
          </div>

          <div className="space-y-1.5">
            {demos.map((d) => (
              <button
                key={d.role}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword("Harborlane!26");
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl border text-left text-xs transition-all ${
                  email === d.email
                    ? "border-brand bg-brand-subtle/40 shadow-2xs"
                    : "border-slate-200/70 hover:bg-slate-50/80"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={roleBadgeClass(d.role.toLowerCase())}>{d.role}</span>
                  <span className="font-medium text-ink truncate max-w-[150px] sm:max-w-[180px]">
                    {d.email.split("@")[0].replace(".", " ")}
                  </span>
                </div>
                <span className="text-[10px] text-muted hidden sm:inline">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
