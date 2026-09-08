// Pure time helpers — no node: imports, safe to import from components.

export function toSeconds(
  value: string | number | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  const parts = value.split(":").map(Number);
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n)))
    return undefined;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function hms(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Seconds -> an ISO 8601 duration (`PT1H2M3S`), for a valid <time dateTime>. */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s % 60}S`;
}
