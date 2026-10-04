import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-white text-accent shadow-sm" : "text-muted hover:bg-white/70 hover:text-ink"
  }`;

const side = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm ${
    isActive ? "bg-teal-50 text-accent font-medium" : "text-muted hover:bg-white hover:text-ink"
  }`;

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const ops = user?.role !== "admin";
  const listActive = loc.pathname.startsWith("/list") || loc.pathname.startsWith("/tasks");

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-border bg-elevated px-4 py-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-brand">OPSNINJA</div>
          <div className="text-xs text-muted">Harborlane Retail</div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <div className="font-medium text-ink">{user?.name}</div>
            <div className="capitalize text-muted">{user?.role}</div>
          </div>
          <button type="button" className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-ink" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[200px_1fr]">
        <aside className="border-b border-border bg-elevated p-3 lg:min-h-[calc(100vh-65px)] lg:border-b-0 lg:border-r">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Workspace</div>
          <nav className="space-y-0.5">
            <NavLink to="/chat" className={side}>
              Chat
            </NavLink>
            <NavLink to="/notifications" className={side}>
              Notifications
            </NavLink>
            {user?.role === "admin" ? (
              <NavLink to="/" className={side} end>
                Platform
              </NavLink>
            ) : null}
          </nav>
        </aside>
        <div>
          {ops ? (
            <div className="border-b border-border bg-surface px-3 py-2">
              <nav className="flex flex-wrap gap-1">
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
          <main className="p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
