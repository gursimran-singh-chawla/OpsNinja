import { useState } from "react";

function generateSecureRoomName(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `opsninja-meet-${hex}`;
}

export function Meetings() {
  const [activeMeetingUrl, setActiveMeetingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  function handleStartInstant() {
    const room = generateSecureRoomName();
    const url = `https://meet.jit.si/${room}`;
    setActiveMeetingUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(false);
    }
  }

  function validateAndNormalizeMeetingUrl(input: string): { valid: boolean; url?: string; error?: string } {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, error: "Please enter a meeting link or room name." };
    }

    // Case 1: Plain room name (e.g., opsninja-meet-abc123 or general room identifier)
    if (!trimmed.includes("/") && !trimmed.includes(".")) {
      if (!/^[a-zA-Z0-9_-]{3,80}$/.test(trimmed)) {
        return {
          valid: false,
          error: "Room name contains invalid characters. Use letters, numbers, hyphens, and underscores.",
        };
      }
      return { valid: true, url: `https://meet.jit.si/${trimmed}` };
    }

    // Case 2: Full URL
    try {
      let candidate = trimmed;
      if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
        candidate = `https://${candidate}`;
      }

      const parsed = new URL(candidate);

      // Must be HTTPS
      if (parsed.protocol !== "https:") {
        return { valid: false, error: "Insecure protocol. Meetings must use secure HTTPS." };
      }

      // Host must strictly be meet.jit.si (reject lookalikes, subdomains, phishing domains)
      if (parsed.hostname.toLowerCase() !== "meet.jit.si") {
        return {
          valid: false,
          error: `Invalid meeting host "${parsed.hostname}". Only official meet.jit.si links are allowed.`,
        };
      }

      // Port must not be custom/unexpected
      if (parsed.port && parsed.port !== "443") {
        return { valid: false, error: "Unexpected port in meeting URL." };
      }

      // Must have a room path
      const room = parsed.pathname.replace(/^\/+/, "");
      if (!room || room.length < 2) {
        return { valid: false, error: "Meeting URL is missing a valid room name." };
      }

      if (!/^[a-zA-Z0-9_\-./]+$/.test(room)) {
        return { valid: false, error: "Room path contains invalid characters." };
      }

      return { valid: true, url: `https://meet.jit.si/${room}` };
    } catch {
      return { valid: false, error: "Malformed URL. Please paste a valid meet.jit.si link." };
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);

    const result = validateAndNormalizeMeetingUrl(joinInput);
    if (!result.valid || !result.url) {
      setJoinError(result.error ?? "Invalid meeting link.");
      return;
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
    setJoinInput("");
  }

  return (
    <div className="max-w-4xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Video Meetings</h1>
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            Jitsi Meet
          </span>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Instant, browser-based video conferencing. Launch a meeting room or join an existing session in a new tab.
        </p>
      </div>

      {/* Main Grid: Start & Join Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Start Instant Meeting */}
        <section className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs backdrop-blur-xs">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-600 shadow-2xs border border-indigo-100">
                📹
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Start an Instant Meeting</h2>
                <p className="text-xs text-slate-400">Generate a cryptographically secure, high-entropy room.</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Need a quick huddle or escalation sync? Create a new room with a single click. OpsNinja will open the call
              in a new tab and give you a link to share with your team.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleStartInstant}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-[0.98] cursor-pointer"
            >
              <span>🚀</span>
              <span>Start Instant Meeting</span>
            </button>
          </div>
        </section>

        {/* Card 2: Join Existing Meeting */}
        <section className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs backdrop-blur-xs">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-xl text-slate-700 shadow-2xs border border-slate-200">
                🔗
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Join a Meeting</h2>
                <p className="text-xs text-slate-400">Enter a meeting link or shared room name.</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="mt-4 space-y-3">
              <div>
                <label htmlFor="join-meeting-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Meeting URL or Room Identifier
                </label>
                <input
                  id="join-meeting-input"
                  type="text"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  placeholder="https://meet.jit.si/opsninja-meet-... or room-name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {joinError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {joinError}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!joinInput.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Join Meeting</span>
                  <span className="text-xs opacity-75">↗</span>
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 text-[11px] text-slate-400">
            Accepts official <span className="font-mono text-slate-600">meet.jit.si</span> HTTPS links or room codes.
          </div>
        </section>
      </div>

      {/* Active Meeting Room Details Card */}
      {activeMeetingUrl && (
        <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/50 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Active Meeting Created
                </span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-900 break-all font-mono">
                {activeMeetingUrl}
              </div>
              <div className="text-[11px] text-slate-500">
                Opened in a new browser tab. Share this link with teammates in OpsNinja Chat.
              </div>
            </div>

            <div className="flex items-center gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={() => void handleCopy(activeMeetingUrl)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition active:scale-95 cursor-pointer"
              >
                <span>{copied ? "✓" : "📋"}</span>
                <span>{copied ? "Link Copied!" : "Copy Link"}</span>
              </button>

              <button
                type="button"
                onClick={() => window.open(activeMeetingUrl, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition active:scale-95 cursor-pointer"
              >
                <span>Re-open</span>
                <span className="text-xs">↗</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Security & Public Jitsi Notice */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-600">
        <div className="flex items-start gap-2.5">
          <span className="text-sm mt-0.5">ℹ️</span>
          <div className="space-y-1">
            <div className="font-semibold text-slate-800">Public Jitsi Meet Integration Notice</div>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Meetings run on the public Jitsi Meet infrastructure (<span className="font-mono">meet.jit.si</span>).
              Room names are cryptographically generated to prevent collisions, but meetings are unauthenticated and
              open to anyone with the link. Do not conduct classified discussions or transmit sensitive credentials over
              public meetings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
