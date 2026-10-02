export function log(level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) {
  const line = { ts: new Date().toISOString(), level, msg, ...extra };
  if (level === "error") console.error(JSON.stringify(line));
  else if (level === "warn") console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}
