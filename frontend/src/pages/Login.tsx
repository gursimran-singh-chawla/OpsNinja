import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

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
    <div className="grid min-h-screen place-items-center bg-zinc-950 px-4">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-900/40 p-8">
        <div className="text-xs font-semibold tracking-[0.25em] text-amber-500">OPSNINJA</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Harborlane operations</h1>
        <p className="mt-2 text-sm text-zinc-400">
          One place for operational problems: who created them, who can see them, who owns the work.
        </p>
        <form className="mt-8 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-xs text-zinc-400">
            Email
            <input
              className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Password
            <input
              type="password"
              className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            disabled={busy}
            className="w-full bg-amber-600 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-6 text-xs text-zinc-500">
          Demo password for all accounts: <span className="text-zinc-300">Harborlane!26</span>
          <ul className="mt-2 space-y-1">
            {demos.map(([e, r]) => (
              <li key={e}>
                <button type="button" className="text-left text-zinc-400 hover:text-amber-500" onClick={() => setEmail(e)}>
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
