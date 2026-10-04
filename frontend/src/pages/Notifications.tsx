import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type N = { id: string; type: string; taskId: string | null; readAt: string | null; createdAt: string };

export function Notifications() {
  const [data, setData] = useState<{ items: N[]; unread: number } | null>(null);
  useEffect(() => {
    api<{ items: N[]; unread: number }>("/api/notifications").then(setData);
  }, []);

  async function read(id?: string) {
    await api("/api/notifications/read", { method: "POST", body: JSON.stringify({ id }) });
    setData(await api("/api/notifications"));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <button className="text-sm text-accent hover:underline" onClick={() => void read()}>
          Mark all read
        </button>
      </div>
      <p className="text-sm text-muted">{data ? `${data.unread} unread` : ""}</p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-elevated">
        {data?.items.map((n) => (
          <li key={n.id} className={`flex items-center justify-between px-4 py-3 text-sm ${n.readAt ? "text-muted" : ""}`}>
            <div>
              <div>{n.type.replaceAll("_", " ")}</div>
              <div className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex gap-3">
              {n.taskId ? (
                <Link className="text-accent hover:underline" to={`/tasks/${n.taskId}`}>
                  Open
                </Link>
              ) : null}
              {!n.readAt ? (
                <button className="text-muted hover:text-ink" onClick={() => void read(n.id)}>
                  Read
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
