import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type N = { id: string; type: string; caseId: string | null; readAt: string | null; createdAt: string };

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
        <button className="text-sm text-amber-500" onClick={() => void read()}>
          Mark all read
        </button>
      </div>
      <p className="text-sm text-zinc-500">{data ? `${data.unread} unread` : ""}</p>
      <ul className="mt-4 divide-y divide-zinc-800 border border-zinc-800">
        {data?.items.map((n) => (
          <li key={n.id} className={`flex items-center justify-between px-4 py-3 text-sm ${n.readAt ? "text-zinc-500" : ""}`}>
            <div>
              <div>{n.type.replaceAll("_", " ")}</div>
              <div className="text-xs text-zinc-600">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex gap-3">
              {n.caseId ? (
                <Link className="text-amber-500" to={`/cases/${n.caseId}`}>
                  Open
                </Link>
              ) : null}
              {!n.readAt ? (
                <button className="text-zinc-400" onClick={() => void read(n.id)}>
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
