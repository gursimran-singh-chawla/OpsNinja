import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../auth";

type Msg = { id: string; body: string; createdAt: string; sender: { id: string; name: string } };
type ConvList = {
  global: { id: string };
  dms: { id: string; participants: { user: { id: string; name: string } }[] }[];
};
type Person = { id: string; name: string; role: string };

export function Chat() {
  const { user } = useAuth();
  const [list, setList] = useState<ConvList | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [status, setStatus] = useState("connecting");
  const sock = useRef<Socket | null>(null);

  useEffect(() => {
    api<ConvList>("/api/chat/conversations").then((d) => {
      setList(d);
      setActive(d.global.id);
    });
    api<Person[]>("/api/users").then((p) => setPeople(p.filter((u) => u.role !== "admin" && u.id !== user?.id)));
  }, [user]);

  useEffect(() => {
    if (!active) return;
    api<Msg[]>(`/api/chat/conversations/${active}/messages`).then(setMessages);
    const s = io({ withCredentials: true });
    sock.current = s;
    s.on("connect", () => setStatus("live"));
    s.on("disconnect", () => setStatus("reconnecting"));
    s.emit("join", active);
    s.on("message", (m: Msg) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    return () => {
      s.close();
    };
  }, [active]);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active) return;
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "");
    e.currentTarget.reset();
    sock.current?.emit("message", { conversationId: active, body });
  }

  async function startDm(userId: string) {
    const conv = await api<{ id: string }>("/api/chat/dm", { method: "POST", body: JSON.stringify({ userId }) });
    const d = await api<ConvList>("/api/chat/conversations");
    setList(d);
    setActive(conv.id);
  }

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-xl border border-border bg-elevated p-3">
        <div className="text-xs uppercase text-muted">Conversations</div>
        <button
          className={`mt-2 block w-full rounded-md px-2 py-2 text-left text-sm ${active === list?.global.id ? "bg-teal-50 text-accent" : "hover:bg-surface"}`}
          onClick={() => list && setActive(list.global.id)}
        >
          Global
        </button>
        {list?.dms.map((d) => {
          const other = d.participants.map((p) => p.user).find((u) => u.id !== user?.id);
          return (
            <button
              key={d.id}
              className={`mt-1 block w-full rounded-md px-2 py-2 text-left text-sm ${active === d.id ? "bg-teal-50 text-accent" : "hover:bg-surface"}`}
              onClick={() => setActive(d.id)}
            >
              {other?.name ?? "DM"}
            </button>
          );
        })}
        <div className="mt-4 text-xs uppercase text-muted">New DM</div>
        {people.map((p) => (
          <button key={p.id} className="mt-1 block w-full px-2 py-1 text-left text-xs text-muted hover:text-accent" onClick={() => void startDm(p.id)}>
            {p.name}
          </button>
        ))}
      </aside>
      <section className="flex flex-col rounded-xl border border-border bg-elevated">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted">
          <span>Harborlane chat</span>
          <span>{status}</span>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id}>
              <div className="text-xs text-muted">
                {m.sender.name} · {new Date(m.createdAt).toLocaleTimeString()}
              </div>
              <div className="text-sm">{m.body}</div>
            </div>
          ))}
        </div>
        <form className="flex border-t border-border" onSubmit={(e) => void send(e)}>
          <input name="body" required className="flex-1 bg-transparent px-4 py-3 text-sm outline-none" placeholder="Message — @Name to mention" />
          <button className="px-4 text-sm text-accent">Send</button>
        </form>
      </section>
    </div>
  );
}
