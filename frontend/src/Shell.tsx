import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { roleBadgeClass } from "./ui";

function userInitials(name?: string) {
  if (!name) return "ON";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "ON";
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const ops = user?.role !== "admin";
  const listActive = loc.pathname.startsWith("/list") || loc.pathname.startsWith("/tasks");

  const tab = ({ isActive }: { isActive: boolean }) =>
    `relative px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
      isActive
        ? "bg-white text-brand shadow-xs font-semibold"
        : "text-muted hover:text-ink hover:bg-slate-200/50"
    }`;

  const side = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs sm:text-sm transition-all ${
      isActive
        ? "bg-brand-subtle text-brand font-semibold shadow-2xs"
        : "text-muted hover:bg-slate-100/80 hover:text-ink"
    }`;

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between glass-nav px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          <button
            type="button"
            className="lg:hidden p-1.5 text-muted hover:text-ink rounded-md hover:bg-slate-100"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white shadow-xs font-bold text-sm tracking-tighter">
              ON
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-[0.2em] text-ink">OPSNINJA</span>
                <span className="hidden sm:inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-medium text-emerald-600 border border-emerald-500/20">
                  Live
                </span>
              </div>
              <div className="text-[11px] text-muted leading-tight font-medium">IG Incorporation</div>
            </div>
          </div>
        </div>

        {/* User profile & actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-border-subtle rounded-full py-1 pl-1.5 pr-3 shadow-2xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
              {userInitials(user?.name)}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-ink leading-tight">{user?.name}</div>
              <div className="text-[10px] text-muted capitalize leading-tight flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${user?.role === 'admin' ? 'bg-purple-500' : 'bg-indigo-500'}`}></span>
                {user?.role}
              </div>
            </div>
            <span className={`sm:hidden text-[10px] px-1.5 py-0.5 rounded-full border ${roleBadgeClass(user?.role ?? "")}`}>
              {user?.role}
            </span>
          </div>

          <button
            type="button"
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted hover:border-slate-300 hover:text-ink hover:bg-slate-50 transition active:scale-95 shadow-2xs cursor-pointer"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 lg:grid lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside
          className={`${
            mobileMenuOpen ? "block" : "hidden"
          } lg:block border-b border-border bg-white/70 backdrop-blur-md p-4 lg:min-h-[calc(100vh-57px)] lg:border-b-0 lg:border-r border-slate-200/80 transition-all`}
        >
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted/80">
            Workspace
          </div>
          <nav className="space-y-1">
            <NavLink to="/chat" className={side} onClick={() => setMobileMenuOpen(false)}>
              <span className="text-sm">💬</span>
              <span>Chat</span>
            </NavLink>
            <NavLink to="/notifications" className={side} onClick={() => setMobileMenuOpen(false)}>
              <span className="text-sm">🔔</span>
              <span>Notifications</span>
            </NavLink>
            {user?.role === "admin" ? (
              <NavLink to="/" className={side} end onClick={() => setMobileMenuOpen(false)}>
                <span className="text-sm">🛡️</span>
                <span>Platform Admin</span>
              </NavLink>
            ) : null}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex flex-col min-w-0">
          {ops ? (
            <div className="border-b border-border bg-slate-100/60 px-4 py-2 sm:px-6">
              <nav className="flex flex-wrap items-center gap-1.5 p-0.5 bg-slate-200/60 rounded-xl w-fit">
                <NavLink to="/" className={tab} end>
                  Summary
                </NavLink>
                <NavLink to="/list" className={({ isActive }) => tab({ isActive: isActive || listActive })}>
                  List
                </NavLink>
                <NavLink to="/board" className={tab}>
                  Board
                </NavLink>
                <NavLink to="/people" className={tab}>
                  People
                </NavLink>
              </nav>
            </div>
          ) : null}

          <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</main>
        </div>
      </div>
    </div>
  );
}
