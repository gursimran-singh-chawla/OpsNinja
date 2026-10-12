import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { btnPrimary, field } from "../ui";

export function VerifyEmail() {
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(false);

  // Pre-fill email from query parameter if provided
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam.trim());
    }
  }, [searchParams]);

  // Handle countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Clean code input (strictly 6 numeric digits)
  function handleCodeChange(val: string) {
    const numeric = val.replace(/\D/g, "").slice(0, 6);
    setCode(numeric);
    if (error) setError(null);
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please provide your work email address");
      return;
    }
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await verifyEmail(email.trim(), code);
      if (res.approved) {
        // Approved user automatically routes to dashboard
        navigate("/", { replace: true });
      } else {
        // Unapproved user shows waiting approval confirmation screen
        setPendingApproval(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!email.trim() || cooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await resendVerification(email.trim());
      setSuccessMsg(res.message || "A fresh verification code has been sent to your email.");
      setCooldown(60); // 60-second cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  }

  if (pendingApproval) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Ambient background glow accents */}
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 animate-fade-in text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-2xl shadow-sm">
            ⏳
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-ink">
            Email Verified Successfully!
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
            Your email has been confirmed. Your account is now <strong>waiting for administrator approval</strong> and will be available to log in in some time once approved.
          </p>

          <div className="mt-5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-900 text-left space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Administrator Review Required</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              New accounts require platform approval before accessing operational tasks. You will be able to sign in once an admin activates your account.
            </p>
          </div>

          <div className="mt-6">
            <Link
              to="/login"
              className={`${btnPrimary} w-full py-2.5 font-semibold text-sm`}
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
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
          Verify your email
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-muted leading-relaxed">
          We sent a 6-digit verification code to your email. Enter it below to activate your operational account.
        </p>

        {/* Verification Form */}
        <form className="mt-6 space-y-4" onSubmit={(e) => void onVerify(e)}>
          <div>
            <label className="block text-xs font-medium text-ink-muted">Work email address</label>
            <input
              type="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.morgan@igincorporation.example"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-ink-muted">
                6-digit verification code
              </label>
              <span className="text-[11px] text-muted">Expires in 10 minutes</span>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="••••••"
                className="w-full text-center font-mono text-2xl tracking-[0.4em] font-bold py-3.5 px-4 rounded-xl border border-slate-200/90 bg-slate-50/60 text-indigo-950 shadow-2xs placeholder:text-slate-300 placeholder:tracking-normal focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                required
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-due flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || code.length !== 6 || !email.trim()}
            className={`${btnPrimary} w-full py-2.5 font-semibold text-sm disabled:opacity-50`}
          >
            {busy ? "Verifying code…" : "Verify and Continue"}
          </button>
        </form>

        {/* Resend actions & countdown */}
        <div className="mt-5 border-t border-slate-100 pt-4 flex flex-col items-center gap-2 text-xs">
          <div className="text-muted text-center">
            Didn't receive the email?{" "}
            {cooldown > 0 ? (
              <span className="text-slate-500 font-medium">
                Resend code in <strong className="text-brand tabular-nums">{cooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void onResend()}
                disabled={resending || !email.trim()}
                className="font-semibold text-brand hover:underline disabled:opacity-50 cursor-pointer"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            )}
          </div>

          <p className="mt-2 text-center text-xs text-muted">
            <Link to="/login" className="text-slate-500 hover:text-ink transition">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
