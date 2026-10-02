import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";

const link = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm ${isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`;

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-zinc-800 bg-zinc-950 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-amber-500">OPSNINJA</div>
            <div className="mt-1 text-xs text-zinc-500">Harborlane Retail</div>
          </div>
          <div className="text-xs text-zinc-500 lg:mt-6">
            {user?.name}
            <div className="capitalize text-zinc-400">{user?.role}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:block lg:space-y-1 lg:overflow-visible">
          <NavLink to="/" className={link} end>
            Home
          </NavLink>
          {user?.role !== "admin" ? (
            <>
              <NavLink to="/cases" className={link}>
                Cases
              </NavLink>
              <NavLink to="/chat" className={link}>
                Chat
              </NavLink>
            </>
          ) : null}
          <NavLink to="/people" className={link}>
            People
          </NavLink>
          <NavLink to="/notifications" className={link}>
            Notifications
          </NavLink>
          {user?.role === "admin" ? (
            <NavLink to="/admin" className={link}>
              Platform
            </NavLink>
          ) : null}
        </nav>
        <button
          type="button"
          className="m-3 hidden rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white lg:inline-block"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </aside>
      <main className="min-h-screen bg-zinc-950 p-4 lg:p-8">{children}</main>
    </div>
  );
}
