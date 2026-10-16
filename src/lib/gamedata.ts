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
}

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
