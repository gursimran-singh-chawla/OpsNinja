import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { btnPrimary, field } from "../ui";

const roles = [
  ["associate", "Associate"],
  ["manager", "Manager"],
  ["lead", "Lead"],
] as const;

export function Signup() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof roles)[number][0]>("associate");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup({ name, email, password, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-md rounded-xl border border-border bg-elevated p-8 shadow-sm">
        <div className="text-xs font-semibold tracking-[0.25em] text-brand">OPSNINJA</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-2 text-sm text-muted">
          Lead, Manager, and Associate can sign up. Admin accounts are created by the platform, not here.
        </p>
        <label className="mt-6 block text-xs text-muted">
          Name
          <input required className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Email
          <input required type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Password
          <input required minLength={8} type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Role
          <select className={field} value={role} onChange={(e) => setRole(e.target.value as (typeof roles)[number][0])}>
            {roles.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="mt-3 text-sm text-due">{error}</p> : null}
        <button disabled={busy} className={`mt-4 w-full ${btnPrimary}`}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
