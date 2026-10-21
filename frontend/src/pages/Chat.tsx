import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { api, getApiBaseUrl } from "../api";
import { useAuth } from "../auth";

type Msg = { id: string; body: string; createdAt: string; sender: { id: string; name: string } };
type ConvList = {
  global: { id: string };
  dms: { id: string; participants: { user: { id: string; name: string } }[] }[];
};
type Person = { id: string; name: string; email?: string; role: string };

export function Chat() {
  const { user } = useAuth();
  const [list, setList] = useState<ConvList | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [pendingRecipient, setPendingRecipient] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [inputVal, setInputVal] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Delete modal state
  const [conversationToDelete, setConversationToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sock = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch initial conversations and people
  useEffect(() => {
    api<ConvList>("/api/chat/conversations").then((d) => {
      setList(d);
      setActive(d.global.id);
    });
    api<Person[]>("/api/users").then((p) => setPeople(p.filter((u) => u.role !== "admin" && u.id !== user?.id)));

    const token = typeof window !== "undefined" ? localStorage.getItem("opsninja_token") : null;
    const socketBase = import.meta.env.VITE_SOCKET_URL || getApiBaseUrl() || "https://opsninja.onrender.com";
    const s = io(socketBase, { withCredentials: true, auth: { token } });
    sock.current = s;

    s.on("connect", () => setStatus("live"));
    s.on("disconnect", () => setStatus("reconnecting"));
    s.on("message", (m: Msg) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    s.on("dm_update", () => {
      api<ConvList>("/api/chat/conversations").then(setList);
    });

    return () => {
      s.close();
      sock.current = null;
    };
  }, [user]);

  // When active conversation changes, fetch messages and join room
  useEffect(() => {
    if (!active) {
      setMessages([]);
      return;
    }
    api<Msg[]>(`/api/chat/conversations/${active}/messages`).then(setMessages);
    if (sock.current?.connected) {
      sock.current.emit("join", active);
    } else {
      sock.current?.once("connect", () => {
        sock.current?.emit("join", active);
      });
    }
  }, [active]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Debounced search for people
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      api<Person[]>(`/api/chat/users/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => {
          setSearchResults(res);
          setIsSearching(false);
        })
        .catch(() => {
          setSearchResults([]);
          setIsSearching(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search results dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectPerson(person: Person) {
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);

    // If an established conversation already exists in DM list, open it
    const existing = list?.dms.find((d) => d.participants.some((p) => p.user.id === person.id));
    if (existing) {
      setActive(existing.id);
      setPendingRecipient(null);
    } else {
      // Enter temporary new-chat state without persisting anything
      setPendingRecipient(person);
      setActive(null);
      setMessages([]);
    }
  }

  function selectChannel(id: string) {
    setPendingRecipient(null);
    setActive(id);
  }

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const body = inputVal.trim();
    setInputVal("");

    if (pendingRecipient) {
      // Send first message: atomically create DM and persist message
      try {
        const res = await api<{ conversation: ConvList["dms"][0]; message: Msg }>("/api/chat/dm/send", {
          method: "POST",
          body: JSON.stringify({ userId: pendingRecipient.id, body }),
        });
        const newDm = res.conversation;
        const newMsg = res.message;
        setList((prev) => {
          if (!prev) return prev;
          const exists = prev.dms.some((d) => d.id === newDm.id);
          return {
            ...prev,
            dms: exists ? prev.dms : [newDm, ...prev.dms],
          };
        });
        setPendingRecipient(null);
        setActive(newDm.id);
        setMessages([newMsg]);
        sock.current?.emit("join", newDm.id);
      } catch (err) {
        console.error("Failed to send initial direct message:", err);
      }
      return;
    }

    if (!active) return;
    sock.current?.emit("message", { conversationId: active, body });
  }

  async function confirmDeleteConversation() {
    if (!conversationToDelete) return;
    setIsDeleting(true);
    try {
      await api(`/api/chat/conversations/${conversationToDelete.id}`, { method: "DELETE" });
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          dms: prev.dms.filter((d) => d.id !== conversationToDelete.id),
        };
      });
      if (active === conversationToDelete.id) {
        setActive(list?.global.id ?? null);
      }
      setConversationToDelete(null);
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  const activeDm = list?.dms.find((d) => d.id === active);
  const activeDmRecipient = activeDm?.participants.map((p) => p.user).find((u) => u.id !== user?.id);

  const activeTitle = pendingRecipient
    ? `@${pendingRecipient.name}`
    : active === list?.global.id
      ? "# Global Operations"
      : activeDmRecipient
        ? `@${activeDmRecipient.name}`
        : "Chat";

  const activeSubtitle = pendingRecipient
    ? "Direct private channel • New conversation"
    : active === list?.global.id
      ? "Real-time updates, task discussions & operational broadcasts"
      : "Direct private channel";

  return (
    <div className="grid min-h-[75vh] gap-4 rounded-2xl border border-slate-200/90 bg-white/90 p-2 shadow-xs backdrop-blur-xs lg:grid-cols-[280px_1fr]">
      {/* Conversations Sidebar */}
      <aside className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-3">
        {/* Channels */}
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Channels</div>
        <div className="mt-1 space-y-1">
          <button
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
              active === list?.global.id && !pendingRecipient
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-700 hover:bg-white hover:text-slate-900"
            }`}
            onClick={() => list && selectChannel(list.global.id)}
          >
            <span className="text-sm font-bold opacity-80">#</span>
            <div className="flex-1 truncate">
              <div>global-ops</div>
              <div
                className={`text-[10px] font-normal ${
                  active === list?.global.id && !pendingRecipient ? "text-indigo-200" : "text-slate-400"
                }`}
              >
                Organization wide
              </div>
            </div>
          </button>
        </div>

        {/* Direct Messages Section with Search */}
        <div className="mt-5 px-2 py-1 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Direct Messages</span>
        </div>

        {/* Search for People */}
        <div className="relative mt-1 px-1" ref={searchContainerRef}>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-2.5 text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search people..."
              className="w-full rounded-lg border border-slate-200/90 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchOpen(false);
                }}
                className="absolute right-2 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute left-1 right-1 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {isSearching ? (
                <div className="px-3 py-2 text-center text-xs text-slate-400">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-2 text-center text-xs text-slate-400">No users found</div>
              ) : (
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPerson(p)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-indigo-50 hover:text-indigo-900 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        {p.email && <div className="text-[10px] text-slate-400 truncate">{p.email}</div>}
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium capitalize text-slate-500">
                      {p.role}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Established Direct Messages List */}
        <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
          {list?.dms.length === 0 && !pendingRecipient && (
            <div className="px-3 py-4 text-center text-[11px] text-slate-400">
              No active conversations yet. Search for people above to start a chat.
            </div>
          )}

          {/* Temporary new chat badge if pending */}
          {pendingRecipient && (
            <div className="flex w-full items-center gap-2.5 rounded-lg bg-indigo-600 px-3 py-2 text-left text-xs font-semibold text-white shadow-xs">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-indigo-700">
                {pendingRecipient.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 truncate">
                <div className="truncate">{pendingRecipient.name}</div>
                <div className="text-[9px] font-normal text-indigo-200">New conversation</div>
              </div>
            </div>
          )}

          {list?.dms.map((d) => {
            const other = d.participants.map((p) => p.user).find((u) => u.id !== user?.id);
            const isSel = active === d.id && !pendingRecipient;
            return (
              <div
                key={d.id}
                className={`group flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                  isSel
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
              >
                <button
                  type="button"
                  className="flex flex-1 min-w-0 items-center gap-2 text-left"
                  onClick={() => selectChannel(d.id)}
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
                <button
                  type="button"
                  title="Delete conversation for me"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConversationToDelete({ id: d.id, name: other?.name || "Direct Message" });
                  }}
                  className={`ml-1 shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 transition focus:opacity-100 ${
                    isSel
                      ? "text-indigo-200 hover:bg-indigo-700 hover:text-white"
                      : "text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Start new DM (people list fallback) */}
        <div className="mt-3 border-t border-slate-200/70 pt-2.5">
          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">People</div>
          <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto pr-1">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs text-slate-600 hover:bg-white hover:text-indigo-600 transition"
                onClick={() => selectPerson(p)}
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
            <p className="text-[11px] text-slate-400">{activeSubtitle}</p>
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

        {/* Messages List Area */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {pendingRecipient ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400 py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-base font-bold text-indigo-600 mb-3 shadow-xs">
                {pendingRecipient.name.slice(0, 2).toUpperCase()}
              </div>
              <p className="text-sm font-bold text-slate-800">
                Start a direct conversation with {pendingRecipient.name}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {pendingRecipient.role}
                </span>
                {pendingRecipient.email && (
                  <span className="text-[11px] text-slate-400">{pendingRecipient.email}</span>
                )}
              </div>
              <p className="mt-3 max-w-sm text-xs text-slate-500">
                No messages sent yet. The conversation will be established in your Direct Messages once you send your first message.
              </p>
            </div>
          ) : messages.length === 0 ? (
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
                        {new Date(m.createdAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
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

      {/* Delete Confirmation Modal ("Delete for me") */}
      {conversationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Conversation</h3>
                <p className="text-xs text-slate-500">
                  Clear conversation with{" "}
                  <span className="font-semibold text-slate-700">{conversationToDelete.name}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs leading-relaxed text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p>
                This action will remove this direct message from your conversation list and clear its history for you.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                The other participant will still keep their message history. If they message you again in the future, this conversation will reappear.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteConversation()}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {isDeleting ? "Deleting..." : "Delete for me"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
