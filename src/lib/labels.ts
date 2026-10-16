import type { Track } from "./plan";

/** "Cannon #3" when there are several of the same building, otherwise just the name. */
export function trackLabeler(tracks: Track[]) {
  const counts = new Map<string, number>();
  for (const t of tracks) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
  return (t: Track) => ((counts.get(t.name) ?? 0) > 1 && t.instance ? `${t.name} #${t.instance}` : t.name);
}
