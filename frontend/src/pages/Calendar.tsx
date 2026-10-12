import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { priorityBadgeClass, roleBadgeClass } from "../ui";

export type CalendarTask = {
  id: string;
  title: string;
  category: string;
  workKind: string;
  priority: string;
  dueAt: string | null;
  visibilityType: string;
  visibilityManager: { name: string } | null;
  finishedAt: string | null;
  archivedAt: string | null;
  createdBy: { name: string };
  assignee: { id: string; name: string } | null;
};

type ViewMode = "month" | "week" | "day";

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTaskDateKey(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return toDateKey(d);
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday as first day of week (day === 0 is Sunday, so diff = -6)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function Calendar() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Navigation and view state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Filter state
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    // Fetch all active & finished tasks
    api<CalendarTask[]>("/api/tasks")
      .then((data) => setTasks(data))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  // Admin policy isolation check (AGENTS.md locked rule)
  if (user?.role === "admin") {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 rounded-2xl border border-slate-200 bg-white shadow-xs text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-700 shadow-2xs">
          🛡️
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Task Access Restricted for Platform Admin</h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          Admin accounts in OpsNinja are platform superusers for identity management and system logs. By architectural
          policy, task schedules and operational records are strictly isolated from Admin view.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 transition"
          >
            Go to Platform Admin
          </Link>
        </div>
      </div>
    );
  }

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (mineOnly && user && t.assignee?.id !== user.id) return false;
      if (hideCompleted && t.finishedAt) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesCategory = t.category.toLowerCase().includes(q);
        const matchesAssignee = t.assignee?.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory && !matchesAssignee) return false;
      }
      return true;
    });
  }, [tasks, mineOnly, user, hideCompleted, search]);

  // Group tasks by DateKey
  const { tasksByDate, unscheduledTasks } = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    const unscheduled: CalendarTask[] = [];

    for (const t of filteredTasks) {
      const key = parseTaskDateKey(t.dueAt);
      if (!key) {
        unscheduled.push(t);
      } else {
        const list = map.get(key) ?? [];
        list.push(t);
        map.set(key, list);
      }
    }
    return { tasksByDate: map, unscheduledTasks: unscheduled };
  }, [filteredTasks]);

  // Navigation handlers
  function handlePrev() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") {
        d.setMonth(d.getMonth() - 1);
      } else if (viewMode === "week") {
        d.setDate(d.getDate() - 7);
      } else {
        d.setDate(d.getDate() - 1);
      }
      return d;
    });
  }

  function handleNext() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") {
        d.setMonth(d.getMonth() + 1);
      } else if (viewMode === "week") {
        d.setDate(d.getDate() + 7);
      } else {
        d.setDate(d.getDate() + 1);
      }
      return d;
    });
  }

  function handleToday() {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }

  // Header Title
  const periodTitle = useMemo(() => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (viewMode === "week") {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const sFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const eFmt = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${sFmt} – ${eFmt}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [currentDate, viewMode]);

  // Determine task status helper
  function getTaskStatus(t: CalendarTask) {
    if (t.finishedAt) return "completed";
    if (!t.dueAt) return "unscheduled";
    const due = new Date(t.dueAt);
    const now = new Date();
    if (due < now) return "overdue";
    if (toDateKey(due) === toDateKey(now)) return "today";
    return "upcoming";
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 line-through opacity-80";
      case "overdue":
        return "border-rose-200 bg-rose-50 text-rose-700 font-semibold";
      case "today":
        return "border-amber-300 bg-amber-50 text-amber-800 font-semibold";
      default:
        return "border-indigo-100 bg-indigo-50/70 text-indigo-700";
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Task Calendar</h1>
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              Schedules
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Internal task deadlines, milestones, and overdue tracking across your workspace.
          </p>
        </div>

        {/* Action button to create task or view unscheduled */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUnscheduledOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer shadow-2xs ${
              unscheduledOpen
                ? "border-indigo-400 bg-indigo-50 text-indigo-900 font-semibold"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>📋 Unscheduled Tasks</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
              {unscheduledTasks.length}
            </span>
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {err}
        </div>
      )}

      {/* Calendar Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrev}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Previous period"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Next period"
            >
              Next ›
            </button>
          </div>

          <div className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{periodTitle}</div>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks..."
              className="w-36 sm:w-44 rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition focus:border-indigo-500 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <button
            type="button"
            onClick={() => setMineOnly((v) => !v)}
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer shadow-2xs ${
              mineOnly
                ? "border-indigo-400 bg-indigo-50 text-indigo-900 font-semibold"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            My tasks
          </button>

          <button
            type="button"
            onClick={() => setHideCompleted((v) => !v)}
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer shadow-2xs ${
              hideCompleted
                ? "border-indigo-400 bg-indigo-50 text-indigo-900 font-semibold"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Hide done
          </button>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 shadow-2xs">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setViewMode(mode);
                  if (mode === "day") setSelectedDate(currentDate);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition cursor-pointer ${
                  viewMode === mode
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout: Calendar Grid + Unscheduled Drawer */}
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Calendar View Area */}
        <div className="min-w-0">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400 animate-pulse">
              Loading calendar tasks...
            </div>
          ) : viewMode === "month" ? (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d);
                setCurrentDate(d);
              }}
              tasksByDate={tasksByDate}
              getTaskStatus={getTaskStatus}
              getStatusBadge={getStatusBadge}
            />
          ) : viewMode === "week" ? (
            <WeekView
              currentDate={currentDate}
              tasksByDate={tasksByDate}
              getTaskStatus={getTaskStatus}
              getStatusBadge={getStatusBadge}
            />
          ) : (
            <DayView
              selectedDate={selectedDate}
              tasksByDate={tasksByDate}
              getTaskStatus={getTaskStatus}
              getStatusBadge={getStatusBadge}
            />
          )}
        </div>

        {/* Collapsible Unscheduled Tasks Drawer */}
        {unscheduledOpen && (
          <aside className="w-full lg:w-80 shrink-0 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs h-fit space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Unscheduled Tasks</h3>
                <p className="text-[11px] text-slate-400">Tasks with no deadline assigned</p>
              </div>
              <button
                type="button"
                onClick={() => setUnscheduledOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
                title="Close drawer"
              >
                ✕
              </button>
            </div>

            {unscheduledTasks.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">All tasks have due dates assigned!</div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
                {unscheduledTasks.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tasks/${t.id}`}
                    className="block rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs transition hover:bg-indigo-50/50 hover:border-indigo-200 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${priorityBadgeClass(t.priority)}`}>
                        {t.priority}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">{t.workKind}</span>
                    </div>
                    <div className="mt-1 font-semibold text-slate-800 group-hover:text-indigo-900 line-clamp-2">
                      {t.title}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{t.assignee?.name ?? "Unassigned"}</span>
                      <span className="text-indigo-600 font-medium group-hover:underline">Schedule →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Month View Component
// -------------------------------------------------------------
function MonthView({
  currentDate,
  selectedDate,
  onSelectDate,
  tasksByDate,
  getTaskStatus,
  getStatusBadge,
}: {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  tasksByDate: Map<string, CalendarTask[]>;
  getTaskStatus: (t: CalendarTask) => string;
  getStatusBadge: (s: string) => string;
}) {
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday as day 0
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Preceding padding days
    for (let i = startOffset; i > 0; i--) {
      days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
    }

    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Post padding days (to complete 35 or 42 grid cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selectedDate);
  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80 text-center text-xs font-semibold text-slate-500 py-2.5">
        {weekDayHeaders.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
        {monthDays.map(({ date, isCurrentMonth }, idx) => {
          const dateKey = toDateKey(date);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedKey;
          const dayTasks = tasksByDate.get(dateKey) ?? [];

          return (
            <div
              key={idx}
              onClick={() => onSelectDate(date)}
              className={`min-h-[105px] p-2 flex flex-col justify-between transition cursor-pointer hover:bg-indigo-50/30 ${
                !isCurrentMonth ? "bg-slate-50/40 text-slate-300" : "bg-white text-slate-700"
              } ${isSelected ? "ring-2 ring-indigo-500 ring-inset bg-indigo-50/20" : ""}`}
            >
              {/* Day Number and Count */}
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${
                    isToday
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : isSelected
                      ? "bg-slate-900 text-white font-bold"
                      : isCurrentMonth
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {date.getDate()}
                </span>

                {dayTasks.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                    {dayTasks.length}
                  </span>
                )}
              </div>

              {/* Task Pills on Day Tile */}
              <div className="mt-1.5 space-y-1 flex-1 overflow-hidden">
                {dayTasks.slice(0, 3).map((task) => {
                  const status = getTaskStatus(task);
                  return (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`block truncate rounded-md border px-1.5 py-0.5 text-[10px] transition hover:shadow-2xs ${getStatusBadge(
                        status,
                      )}`}
                      title={`${task.title} (${status})`}
                    >
                      {task.title}
                    </Link>
                  );
                })}

                {dayTasks.length > 3 && (
                  <div className="text-[10px] font-medium text-slate-400 hover:text-indigo-600 pt-0.5">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Week View Component
// -------------------------------------------------------------
function WeekView({
  currentDate,
  tasksByDate,
  getTaskStatus,
  getStatusBadge,
}: {
  currentDate: Date;
  tasksByDate: Map<string, CalendarTask[]>;
  getTaskStatus: (t: CalendarTask) => string;
  getStatusBadge: (s: string) => string;
}) {
  const weekDays = useMemo(() => {
    const start = getStartOfWeek(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const todayKey = toDateKey(new Date());

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <div className="min-w-[700px] grid grid-cols-7 divide-x divide-slate-100">
        {weekDays.map((date, idx) => {
          const dateKey = toDateKey(date);
          const isToday = dateKey === todayKey;
          const dayTasks = tasksByDate.get(dateKey) ?? [];

          return (
            <div key={idx} className="flex flex-col min-h-[500px]">
              {/* Day Header */}
              <div
                className={`border-b border-slate-100 p-3 text-center ${
                  isToday ? "bg-indigo-50/80" : "bg-slate-50/60"
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div
                  className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-800"
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="mt-1 text-[10px] text-slate-400">{dayTasks.length} tasks</div>
              </div>

              {/* Tasks List */}
              <div className="p-2 space-y-2 flex-1 bg-white">
                {dayTasks.length === 0 ? (
                  <div className="pt-8 text-center text-[11px] text-slate-300">No tasks</div>
                ) : (
                  dayTasks.map((task) => {
                    const status = getTaskStatus(task);
                    return (
                      <Link
                        key={task.id}
                        to={`/tasks/${task.id}`}
                        className={`block rounded-xl border p-2.5 text-xs transition hover:shadow-xs group ${getStatusBadge(
                          status,
                        )}`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className={`px-1 rounded font-semibold ${priorityBadgeClass(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className="uppercase text-[9px] font-bold">{status}</span>
                        </div>
                        <div className="mt-1 font-semibold text-slate-900 group-hover:text-indigo-900 line-clamp-2">
                          {task.title}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>{task.assignee?.name ?? "Unassigned"}</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Day View Component
// -------------------------------------------------------------
function DayView({
  selectedDate,
  tasksByDate,
  getTaskStatus,
  getStatusBadge,
}: {
  selectedDate: Date;
  tasksByDate: Map<string, CalendarTask[]>;
  getTaskStatus: (t: CalendarTask) => string;
  getStatusBadge: (s: string) => string;
}) {
  const dateKey = toDateKey(selectedDate);
  const dayTasks = tasksByDate.get(dateKey) ?? [];

  const overdueCount = dayTasks.filter((t) => getTaskStatus(t) === "overdue").length;
  const completedCount = dayTasks.filter((t) => t.finishedAt).length;
  const openCount = dayTasks.length - completedCount;

  return (
    <div className="space-y-6">
      {/* Day Summary Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected Date</div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
              Total: <strong>{dayTasks.length}</strong>
            </span>
            {overdueCount > 0 && (
              <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">
                Overdue: <strong>{overdueCount}</strong>
              </span>
            )}
            <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
              Done: <strong>{completedCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {dayTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-xs text-slate-400">
            No tasks are due on this date.
          </div>
        ) : (
          dayTasks.map((t) => {
            const status = getTaskStatus(t);
            return (
              <Link
                key={t.id}
                to={`/tasks/${t.id}`}
                className="block rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-indigo-300 hover:shadow-sm group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusBadge(status)}`}>
                        {status.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${priorityBadgeClass(t.priority)}`}>
                        {t.priority}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400 capitalize">
                        {t.workKind} • {t.category}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      {t.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 sm:shrink-0 text-xs text-slate-500">
                    <div className="text-right">
                      <div className="font-semibold text-slate-800">{t.assignee?.name ?? "Unassigned"}</div>
                      <div className="text-[10px] text-slate-400">Created by {t.createdBy.name}</div>
                    </div>
                    <span className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition font-bold text-base">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
