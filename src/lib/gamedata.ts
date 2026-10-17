import raw from "../data/gamedata.json";

export type EntityKind = "building" | "trap" | "hero" | "guardian";

export interface EntityLevel {
  /** Town Hall level required to have this level. */
  th: number;
  /** Seconds needed to reach this level from the previous one. */
  time: number;
  /** Required level of `reqBuilding` (the Hero Hall for heroes). */
  req?: number;
}

export interface Entity {
  id: number;
  name: string;
  kind: EntityKind;
  group: string;
  /** Index 0 is level 1. */
  levels: EntityLevel[];
  reqBuilding?: number;
  unlockBuilding?: number;
  unlockBuildingLevel?: number;
  merge?: { id: number; level: number; count: number }[];
}

export interface GameData {
  generatedAt: string;
  source: string;
  townHall: {
    id: number;
    maxLevel: number;
    /** Cumulative max count of each entity id at a given Town Hall level. */
    unlocks: Record<string, Record<string, number>>;
    weapons: Record<string, { name: string; times: number[] }>;
    /** Buildings merged into the Town Hall when upgrading to that level; they no longer exist from then on. */
    merges?: Record<string, { id: number; level: number }[]>;
  };
  entities: Record<string, Entity>;
  helpers: Record<string, Helper>;
}

export interface Helper {
  id: number;
  name: string;
  /** Index 0 is level 1. Once a day, for `seconds`, the assigned job gets `multiplier` extra seconds per second. */
  levels: { th: number; seconds: number; multiplier: number }[];
}

export const BUILDERS_APPRENTICE = 93000000;
export const LAB_ASSISTANT = 93000001;

/** The game's builder cap: five Builder's Huts plus B.O.B. */
export const MAX_BUILDERS = 6;

export const gameData = raw as unknown as GameData;

export function getEntity(id: number): Entity | undefined {
  return gameData.entities[id];
}

/** Highest level of an entity available at the given Town Hall level (0 if locked). */
export function maxLevelAt(entity: Entity, th: number): number {
  let max = 0;
  entity.levels.forEach((l, i) => {
    if (l.th <= th) max = i + 1;
  });
  return max;
}

export function getHelper(id: number): Helper | undefined {
  return gameData.helpers[id];
}

/** Highest helper level available at the given Town Hall level (0 if not unlocked yet). */
export function helperMaxLevelAt(id: number, th: number): number {
  return getHelper(id)?.levels.filter((l) => l.th <= th).length ?? 0;
}

/** A helper's once-a-day boost at a level (nothing at level 0). */
export function helperDailyBoost(id: number, level: number): { seconds: number; multiplier: number } {
  const l = getHelper(id)?.levels[level - 1];
  return l ? { seconds: l.seconds, multiplier: l.multiplier } : { seconds: 0, multiplier: 0 };
}

export function unlockCount(id: number, th: number): number {
  return gameData.townHall.unlocks[th]?.[id] ?? 0;
}

/** Town Hall level an entity is merged into (and removed at), if any. */
export function mergedIntoTownHallAt(id: number): { th: number; level: number } | undefined {
  for (const [th, reqs] of Object.entries(gameData.townHall.merges ?? {})) {
    const r = reqs.find((m) => m.id === id);
    if (r) return { th: Number(th), level: r.level };
  }
  return undefined;
}
