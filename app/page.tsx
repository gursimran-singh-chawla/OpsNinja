"use client";

import { useCallback, useEffect, useState } from "react";

type CaseItem = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
};

type HealthResponse = { status: string; service: string };

export default function Home() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [healthRes, casesRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/cases"),
      ]);
      if (!healthRes.ok || !casesRes.ok) {
        throw new Error("API request failed");
      }
      setHealth((await healthRes.json()) as HealthResponse);
      const data = (await casesRes.json()) as { cases: CaseItem[] };
      setCases(data.cases);
    } catch {
      setError("Could not load data from the API. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDemoCase() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Investigate alert #${Math.floor(Math.random() * 9000) + 1000}`,
          priority: "medium",
        }),
      });
      if (!res.ok) {
        throw new Error("Create failed");
      }
      const data = (await res.json()) as { case: CaseItem };
      setCases((prev) => [data.case, ...prev]);
    } catch {
      setError("Failed to create a case.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main>
      <h1>OpsPilot</h1>
      <p className="subtitle">
        Operations case management — local development environment
      </p>

      <section className="card">
        <h2>API health</h2>
        {loading && <p className="subtitle">Checking…</p>}
        {!loading && health && (
          <p className="status-ok">
            {health.service}: {health.status}
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Cases</h2>
        {loading ? (
          <p className="subtitle">Loading cases…</p>
        ) : (
          <ul className="case-list">
            {cases.map((c) => (
              <li key={c.id}>
                <span>{c.title}</span>
                <span className="badge">{c.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="primary"
          onClick={() => void createDemoCase()}
          disabled={creating || loading}
        >
          {creating ? "Creating…" : "Create demo case"}
        </button>
      </section>
    </main>
  );
}
