import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { TurnstileWidget } from "../TurnstileWidget";
import { btnPrimary, field } from "../ui";

const roles = [
  { value: "associate", label: "Associate", desc: "Frontline operations, execute and self-assign tasks" },
  { value: "manager", label: "Manager", desc: "Manage team queues, assign direct reports and free agents" },
  { value: "lead", label: "Lead", desc: "Organization-wide operational command and oversight" },
] as const;

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("associate");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCaptcha = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signup({ name, email, password, role, turnstileToken: captchaToken });
      navigate(`/verify-email?email=${encodeURIComponent(result.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 animate-fade-in">
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
          Create an operational account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-muted">
          Create your profile and verify your work email before entering OpsNinja.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted">Full name</label>
            <input
              required
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="e.g. Alex Morgan"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted">Work email</label>
            <input
              required
              type="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="alex.morgan@igincorporation.example"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted">Password (min. 8 characters)</label>
            <input
              required
              minLength={8}
              type="password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Operational role</label>
            <div className="grid grid-cols-1 gap-2">
              {roles.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                    role === r.value
                      ? "border-brand bg-brand-subtle/50 shadow-2xs"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-0.5 text-brand focus:ring-brand"
                  />
                  <div>
                    <div className="font-semibold text-ink">{r.label}</div>
                    <div className="text-[11px] text-muted">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Security check</div>
            <TurnstileWidget onToken={onCaptcha} />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-due flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          <button disabled={busy} className={`${btnPrimary} w-full py-2.5 font-semibold text-sm`}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
