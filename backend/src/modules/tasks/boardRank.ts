const PAD = 12;
const GAP = 1024;
const MAX = 10 ** PAD - 1;

export function encodeRank(n: number) {
  const clamped = Math.max(1, Math.min(MAX, Math.floor(n)));
  return String(clamped).padStart(PAD, "0");
}

export function decodeRank(rank: string) {
  const n = Number.parseInt(rank, 10);
  return Number.isFinite(n) ? n : GAP;
}

export function rankBetween(prev: string | null, next: string | null): string | null {
  const a = prev ? decodeRank(prev) : 0;
  const b = next ? decodeRank(next) : MAX;
  if (b - a <= 1) return null;
  return encodeRank(Math.floor((a + b) / 2));
}

export function ranksForCount(count: number) {
  return Array.from({ length: count }, (_, i) => encodeRank((i + 1) * GAP));
}
