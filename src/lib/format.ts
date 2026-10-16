export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(1, m)}m`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

/** Calendar date `offset` seconds after `base` (unix ms). */
export function formatDate(base: number, offset: number): string {
  return dateFmt.format(new Date(base + offset * 1000));
}

export function normalizeTag(tag: string): string {
  const t = tag.trim().toUpperCase().replace(/^#/, "").replace(/O/g, "0");
  return t ? `#${t}` : "";
}

const shortFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Like formatDate, but without the year when it's within the coming year. */
export function formatShortDate(base: number, offset: number): string {
  return offset < 300 * 86400 ? shortFmt.format(new Date(base + offset * 1000)) : formatDate(base, offset);
}
