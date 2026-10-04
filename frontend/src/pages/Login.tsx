import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { btnPrimary, field } from "../ui";

const demos = [
  ["sarah.okonkwo@harborlane.example", "Lead"],
  ["marcus.hale@harborlane.example", "Manager"],
  ["ravi.mehta@harborlane.example", "Associate"],
  ["amira.hassan@harborlane.example", "Free agent"],
  ["priya.nair@harborlane.example", "Admin"],
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
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-elevated p-8 shadow-sm">
        <div className="text-xs font-semibold tracking-[0.25em] text-brand">OPSNINJA</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Harborlane operations</h1>
        <p className="mt-2 text-sm text-muted">
          One place for operational work: who created it, who can see it, who owns it.
        </p>
        <form className="mt-8 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-xs text-muted">
            Email
            <input
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block text-xs text-muted">
            Password
            <input
              type="password"
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="text-sm text-due">{error}</p> : null}
          <button disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          New to Harborlane?{" "}
          <Link to="/signup" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
        <div className="mt-6 text-xs text-muted">
          Demo password for all accounts: <span className="text-ink">Harborlane!26</span>
          <ul className="mt-2 space-y-1">
            {demos.map(([e, r]) => (
              <li key={e}>
                <button type="button" className="text-left hover:text-accent" onClick={() => setEmail(e)}>
                  {r}: {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
