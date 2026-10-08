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
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [inputVal, setInputVal] = useState("");
  const sock = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !inputVal.trim()) return;
    const body = inputVal.trim();
    setInputVal("");
    sock.current?.emit("message", { conversationId: active, body });
  }

  async function startDm(userId: string) {
    const conv = await api<{ id: string }>("/api/chat/dm", { method: "POST", body: JSON.stringify({ userId }) });
    const d = await api<ConvList>("/api/chat/conversations");
    setList(d);
    setActive(conv.id);
  }

  const activeDm = list?.dms.find((d) => d.id === active);
  const activeDmRecipient = activeDm?.participants.map((p) => p.user).find((u) => u.id !== user?.id);
  const activeTitle = active === list?.global.id ? "# Global Operations" : activeDmRecipient ? `@${activeDmRecipient.name}` : "Chat";

  return (
    <div className="grid min-h-[75vh] gap-4 rounded-2xl border border-slate-200/90 bg-white/90 p-2 shadow-xs backdrop-blur-xs lg:grid-cols-[260px_1fr]">
      {/* Conversations Sidebar */}
      <aside className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-3">
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Channels</div>
        <div className="mt-1 space-y-1">
          <button
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
              active === list?.global.id
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-700 hover:bg-white hover:text-slate-900"
            }`}
            onClick={() => list && setActive(list.global.id)}
          >
            <span className="text-sm font-bold opacity-80">#</span>
            <div className="flex-1 truncate">
              <div>global-ops</div>
              <div className={`text-[10px] font-normal ${active === list?.global.id ? "text-indigo-200" : "text-slate-400"}`}>
                Organization wide
              </div>
            </div>
          </button>
        </div>

        <div className="mt-5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Direct Messages</div>
        <div className="mt-1 flex-1 space-y-1 overflow-y-auto">
          {list?.dms.map((d) => {
            const other = d.participants.map((p) => p.user).find((u) => u.id !== user?.id);
            const isSel = active === d.id;
            return (
              <button
                key={d.id}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                  isSel
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
                onClick={() => setActive(d.id)}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isSel ? "bg-white text-indigo-700" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {other?.name ? other.name.slice(0, 2).toUpperCase() : "DM"}
                </div>
                <span className="truncate">{other?.name ?? "Direct Message"}</span>
              </button>
            );
          })}
        </div>

        {/* Start new DM */}
        <div className="mt-4 border-t border-slate-200/70 pt-3">
          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Start new direct message</div>
          <div className="mt-2 max-h-36 space-y-0.5 overflow-y-auto pr-1">
            {people.map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-white hover:text-indigo-600 transition"
                onClick={() => void startDm(p.id)}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-[10px] text-slate-400 capitalize">{p.role}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Conversation Stream */}
      <section className="flex flex-col rounded-xl border border-slate-100 bg-white">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{activeTitle}</h2>
            <p className="text-[11px] text-slate-400">
              {active === list?.global.id ? "Real-time updates, task discussions & operational broadcasts" : "Direct private channel"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                status === "live"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === "live" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {status === "live" ? "Live" : "Reconnecting"}
            </span>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400 py-12">
              <span className="text-3xl mb-2">💬</span>
              <p className="font-semibold text-slate-600">No messages in this conversation yet</p>
              <p className="text-[11px] text-slate-400 mt-1">Send a message below or use @Name to mention someone</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender.id === user?.id;
              return (
                <div key={m.id} className="flex items-start gap-3 group">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs ${
                      isMe ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                  >
                    {m.sender.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-slate-900">{m.sender.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input Box */}
        <form className="border-t border-slate-100 p-3" onSubmit={(e) => void send(e)}>
          <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50 shadow-2xs focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition">
            <input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="flex-1 bg-transparent px-4 py-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
              placeholder={`Message ${activeTitle} — use @Name to mention...`}
            />
            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="mr-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition"
            >
              <span>Send</span>
              <span>↵</span>
            </button>
          </div>
          <div className="mt-1.5 px-2 text-[10px] text-slate-400">
            Messages are delivered in real time over WebSockets and archived in PostgreSQL.
          </div>
        </form>
      </section>
    </div>
  );
}
