import { gameData, getEntity } from "./gamedata";

/** One group of identical things in the village (e.g. "3 Cannons at level 18"). */
export interface VillageItem {
  id: number;
  level: number;
  count: number;
  /** Seconds left on an upgrade in progress (one instance), already adjusted for export age. */
  timer?: number;
}

export interface Village {
  tag?: string;
  /** Unix seconds when the export was made in-game. */
  timestamp?: number;
  townHall: number;
  thWeapon?: number;
  thWeaponTimer?: number;
  townHallUpgrading?: boolean;
  items: VillageItem[];
  builders: number;
  unknownIds: number[];
}

const BUILDERS_HUT = 1000015;
const BOB_HUT = 1000064;

interface RawEntry {
  data?: number;
  lvl?: number;
  cnt?: number;
  timer?: number;
  weapon?: number;
}

export class ExportError extends Error {}

export function parseExport(text: string, now = Date.now() / 1000): Village {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ExportError("That doesn't look like valid JSON. Paste the full text copied from the game.");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new ExportError("Expected a JSON object (the in-game village export).");
  }
  const obj = json as Record<string, unknown>;
  const timestamp = typeof obj.timestamp === "number" ? obj.timestamp : undefined;
  const elapsed = timestamp ? Math.max(0, now - timestamp) : 0;

  const village: Village = {
    tag: typeof obj.tag === "string" ? obj.tag : undefined,
    timestamp,
    townHall: 0,
    items: [],
    builders: 0,
    unknownIds: [],
  };

  for (const [key, value] of Object.entries(obj)) {
    // Builder Base sections are suffixed with "2" (buildings2, units2, ...).
    if (!Array.isArray(value) || /2$/.test(key)) continue;
    for (const entry of value as RawEntry[]) {
      if (!entry || typeof entry.data !== "number") continue;
      const id = entry.data;
      const level = entry.lvl ?? 0;
      const count = entry.cnt ?? 1;
      const timer = entry.timer != null ? Math.max(0, entry.timer - elapsed) : undefined;

      if (id === gameData.townHall.id) {
        village.townHall = level;
        if (entry.weapon != null) {
          village.thWeapon = entry.weapon;
          if (timer != null) village.thWeaponTimer = timer;
        } else if (timer != null) {
          village.townHallUpgrading = true;
        }
        continue;
      }
      if (id === BUILDERS_HUT || id === BOB_HUT) village.builders += count;
      if (id === BOB_HUT) continue;

      if (!getEntity(id)) {
        if (!village.unknownIds.includes(id)) village.unknownIds.push(id);
        continue;
      }
      village.items.push({ id, level, count, ...(timer != null && { timer }) });
    }
  }

  if (!village.townHall) {
    throw new ExportError("Couldn't find a Town Hall in this export. Is it the home village export?");
  }
  if (!village.builders) village.builders = 5;
  return village;
}
