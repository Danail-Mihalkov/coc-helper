import type { Settings } from "./plan";

export interface Profile {
  tag: string;
  /** Raw export text, re-parsed on load so data updates apply. */
  exportText: string;
  savedAt: number;
  /** May be from an older version; run through normalizeSettings before use. */
  settings?: Partial<Settings>;
}

const KEY = "coc-helper:profiles";
const ACTIVE_KEY = "coc-helper:active";

export function loadProfiles(): Record<string, Profile> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: Record<string, Profile>) {
  localStorage.setItem(KEY, JSON.stringify(profiles));
}

export function loadActive(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActive(tag: string | null) {
  if (tag) localStorage.setItem(ACTIVE_KEY, tag);
  else localStorage.removeItem(ACTIVE_KEY);
}
