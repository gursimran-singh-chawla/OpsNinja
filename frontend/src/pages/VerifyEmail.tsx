import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { btnPrimary, btn, field } from "../ui";

export function VerifyEmail() {
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("We sent a 6-digit code to your email.");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(email, code);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!email || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      await resendVerification(email);
      setMessage("A new verification code has been sent.");
      setCooldown(60);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
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
            <div className="text-xs text-muted font-medium">Email verification</div>
          </div>
        </div>

        <h1 className="mt-6 text-xl sm:text-2xl font-bold tracking-tight text-ink">
          Verify your work email
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-muted">
          Enter the code we sent to activate your account.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted">Work email</label>
            <input
              required
              type="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted">6-digit verification code</label>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              className={`${field} text-center tracking-[0.5em] text-lg font-bold`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoFocus
            />
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900">
            {message}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-due flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          <button disabled={busy || code.length !== 6} className={`${btnPrimary} w-full py-2.5 font-semibold text-sm`}>
            {busy ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={resending || cooldown > 0 || !email}
            className={btn}
          >
            {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>

          <Link to="/login" className="text-xs font-semibold text-brand hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
