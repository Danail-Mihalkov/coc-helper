import {
  BUILDERS_APPRENTICE,
  Entity,
  gameData,
  getEntity,
  helperMaxLevelAt,
  MAX_BUILDERS,
  maxLevelAt,
  mergedIntoTownHallAt,
  unlockCount,
} from "./gamedata";
import type { Village } from "./parseExport";

/** Gold Pass builder boost. Nominally 20%, but because it unlocks partway through the season ~17% is realistic. */
export const GOLD_PASS_BOOST = 0.17;

/** Key used to include/exclude the Town Hall weapon (it has no entity id). */
export const TH_WEAPON_KEY = "th-weapon";

export interface Settings {
  builders: number;
  /** Builder's Apprentice level (0 = not unlocked / not used). */
  apprentice: number;
  goldPass: boolean;
  /** Item keys (entity id as string, or TH_WEAPON_KEY) left out of the plan. */
  excluded: string[];
}

export interface Step {
  idx: number;
  track: Track;
  level: number;
  duration: number;
  inProgress: boolean;
  preds: Step[];
  succs: Step[];
  // Filled in by the scheduler.
  start?: number;
  end?: number;
  slot?: number;
}

export interface Track {
  key: string;
  /** Shared by every instance of the same building; what the include/exclude filter acts on. */
  itemKey: string;
  name: string;
  group: string;
  entity?: Entity;
  /** 1-based instance number among identical buildings (0 for single items). */
  instance: number;
  isNew: boolean;
  /** Left out by the user; only an upgrade already running is kept so its builder stays busy. */
  excluded: boolean;
  from: number;
  to: number;
  steps: Step[];
  notes: string[];
}

export interface Plan {
  townHall: number;
  tracks: Track[];
  steps: Step[];
  settings: Settings;
}

export function defaultSettings(village: Village): Settings {
  return {
    builders: village.builders,
    apprentice: Math.min(village.helpers[BUILDERS_APPRENTICE] ?? 0, helperMaxLevelAt(BUILDERS_APPRENTICE, village.townHall)),
    goldPass: false,
    excluded: [],
  };
}

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

/** Fills in fields missing from settings saved by older versions. */
export function normalizeSettings(village: Village, saved?: Partial<Settings>): Settings {
  const d = defaultSettings(village);
  return {
    builders: clamp(saved?.builders, 1, MAX_BUILDERS, d.builders),
    apprentice: clamp(saved?.apprentice, 0, helperMaxLevelAt(BUILDERS_APPRENTICE, village.townHall), d.apprentice),
    goldPass: saved?.goldPass ?? d.goldPass,
    excluded: Array.isArray(saved?.excluded) ? saved.excluded : d.excluded,
  };
}

export function buildPlan(village: Village, settings: Settings): Plan {
  const th = village.townHall;
  const tracks: Track[] = [];
  const steps: Step[] = [];
  const factor = settings.goldPass ? 1 - GOLD_PASS_BOOST : 1;
  const excluded = new Set(settings.excluded);

  /** Owned instance levels per entity id, highest first. Timers attach to one instance. */
  const owned = new Map<number, { level: number; timer?: number }[]>();
  for (const item of village.items) {
    const list = owned.get(item.id) ?? [];
    for (let i = 0; i < item.count; i++) {
      list.push({ level: item.level, ...(i === 0 && item.timer != null && { timer: item.timer }) });
    }
    owned.set(item.id, list);
  }
  for (const list of owned.values()) list.sort((a, b) => b.level - a.level);

  function addTrack(
    t: Omit<Track, "steps" | "key" | "notes" | "excluded"> & { timer?: number; times: number[] },
  ): Track | undefined {
    const { timer, times, ...rest } = t;
    const isExcluded = excluded.has(rest.itemKey);
    // An excluded item only matters while it's already being upgraded (it ties up a builder).
    if (isExcluded && timer == null) return undefined;
    const track: Track = {
      ...rest,
      to: isExcluded ? Math.min(rest.to, rest.from + 1) : rest.to,
      excluded: isExcluded,
      key: `${rest.name}#${rest.instance}#${tracks.length}`,
      steps: [],
      notes: isExcluded ? ["Excluded — only finishing the upgrade in progress"] : [],
    };
    let prev: Step | undefined;
    for (let level = track.from + 1; level <= track.to; level++) {
      const inProgress = level === track.from + 1 && timer != null;
      const step: Step = {
        idx: steps.length,
        track,
        level,
        duration: inProgress ? timer! : Math.round((times[level - 1] ?? 0) * factor),
        inProgress,
        preds: [],
        succs: [],
      };
      if (prev) link(prev, step);
      steps.push(step);
      track.steps.push(step);
      prev = step;
    }
    tracks.push(track);
    return track;
  }

  const entityTimes = (e: Entity) => e.levels.map((l) => l.time);
  const structures = Object.values(gameData.entities).filter(
    (e) => e.kind === "building" || e.kind === "trap",
  );

  // How many instances of each source building will be consumed by merges.
  const mergeTargets = structures.filter((e) => e.merge);
  const consumed = new Map<number, number>();
  for (const m of mergeTargets) {
    const target = Math.max(owned.get(m.id)?.length ?? 0, unlockCount(m.id, th));
    for (const req of m.merge!) {
      consumed.set(req.id, (consumed.get(req.id) ?? 0) + target * req.count);
    }
  }

  const tracksByEntity = new Map<number, Track[]>();
  const remember = (id: number, track: Track | undefined) => {
    if (!track || track.excluded) return;
    const list = tracksByEntity.get(id) ?? [];
    list.push(track);
    tracksByEntity.set(id, list);
  };

  // Regular buildings and traps (merge targets come after their sources).
  const ordered = [...structures.filter((e) => !e.merge), ...mergeTargets];
  const fodderUsed = new Map<number, number>();
  for (const e of ordered) {
    // Buildings merged into the Town Hall (Eagle Artillery at TH17) are gone from then on.
    const thMerge = mergedIntoTownHallAt(e.id);
    if (thMerge && th >= thMerge.th) continue;
    const max = maxLevelAt(e, th);
    const have = owned.get(e.id) ?? [];
    if (!max && !have.length) continue;
    const base = { name: e.name, group: e.group, entity: e, itemKey: String(e.id), times: entityTimes(e) };

    have.forEach((inst, i) => {
      const track = addTrack({
        ...base,
        instance: i + 1,
        isNew: false,
        from: inst.level,
        to: Math.max(inst.level, max),
        timer: inst.timer,
      });
      if (track && thMerge && th === thMerge.th - 1) {
        track.notes.push(`Merges into the Town Hall at TH${thMerge.th} — needs level ${thMerge.level} first`);
      }
      remember(e.id, track);
    });

    const wanted = e.merge
      ? unlockCount(e.id, th)
      : unlockCount(e.id, th) - (consumed.get(e.id) ?? 0);
    for (let i = have.length; i < wanted; i++) {
      const track = addTrack({ ...base, instance: i + 1, isNew: true, from: 0, to: max });
      if (!track) continue;
      remember(e.id, track);
      if (e.merge) attachMerge(e, track);
      else track.notes.push("New building unlocked at this Town Hall");
    }
  }

  /** A new merged building needs its source buildings upgraded to the merge level first. */
  function attachMerge(e: Entity, track: Track) {
    const first = track.steps[0];
    const parts: string[] = [];
    for (const req of e.merge!) {
      const name = getEntity(req.id)?.name ?? `#${req.id}`;
      parts.push(`${req.count}× ${name} lvl ${req.level}`);
      const sources = (tracksByEntity.get(req.id) ?? []).filter((t) => !t.isNew || t.to >= req.level);
      for (let n = 0; n < req.count; n++) {
        const used = fodderUsed.get(req.id) ?? 0;
        const src = sources[used];
        fodderUsed.set(req.id, used + 1);
        if (!src) continue;
        src.notes.push(`Will be merged into ${e.name} at level ${req.level}`);
        // The source only needs to reach the merge level.
        const reach = src.steps.find((s) => s.level === req.level);
        const extra = src.steps.filter((s) => s.level > req.level);
        if (extra.length) dropSteps(src, extra);
        src.to = Math.min(src.to, Math.max(src.from, req.level));
        if (reach && first) link(reach, first);
      }
    }
    track.notes.push(`Built by merging ${parts.join(" + ")}`);
  }

  // Town Hall weapon.
  const weapon = gameData.townHall.weapons[th];
  if (weapon) {
    const from = village.thWeapon ?? 1;
    addTrack({
      name: `Town Hall (${weapon.name})`,
      group: "Defense",
      itemKey: TH_WEAPON_KEY,
      instance: 0,
      isNew: false,
      from,
      to: Math.max(from, weapon.times.length),
      timer: village.thWeaponTimer,
      times: weapon.times,
    });
  }

  // Heroes and guardians: one instance each. (Lab research and pets aren't planned.)
  const unitDeps: { step: Step; building: number; level: number }[] = [];
  for (const e of Object.values(gameData.entities)) {
    if (e.kind !== "hero" && e.kind !== "guardian") continue;
    const max = maxLevelAt(e, th);
    const inst = owned.get(e.id)?.[0];
    if (!max && !inst) continue;
    const from = inst?.level ?? 0;
    const track = addTrack({
      name: e.name,
      group: e.group,
      entity: e,
      itemKey: String(e.id),
      instance: 0,
      isNew: !inst,
      from,
      to: Math.max(from, max),
      timer: inst?.timer,
      times: entityTimes(e),
    });
    if (!track || track.excluded) continue;
    if (!inst) track.notes.push("Not unlocked yet");
    for (const step of track.steps) {
      const lvl = e.levels[step.level - 1];
      if (e.reqBuilding && lvl?.req) unitDeps.push({ step, building: e.reqBuilding, level: lvl.req });
      if (step.level === 1 && e.unlockBuilding) {
        unitDeps.push({ step, building: e.unlockBuilding, level: e.unlockBuildingLevel ?? 1 });
      }
    }
  }

  // Link hero levels to the Hero Hall level they need.
  for (const { step, building, level } of unitDeps) {
    if (!step.track.steps.includes(step)) continue; // already truncated
    const bTracks = tracksByEntity.get(building) ?? [];
    const best = bTracks.reduce<Track | undefined>((a, b) => (!a || b.to > a.to ? b : a), undefined);
    const current = best?.from ?? owned.get(building)?.[0]?.level ?? 0;
    if (current >= level) continue;
    const gate = best?.steps.find((s) => s.level === level);
    if (gate) {
      link(gate, step);
    } else {
      // The required building level isn't reachable (not available at this TH, or excluded).
      const t = step.track;
      dropSteps(t, t.steps.filter((s) => s.level >= step.level));
      t.to = step.level - 1;
      const bName = getEntity(building)?.name ?? "building";
      t.notes.push(`Capped: needs ${bName} level ${level}`);
    }
  }

  function dropSteps(t: Track, drop: Step[]) {
    const set = new Set(drop);
    t.steps = t.steps.filter((s) => !set.has(s));
    for (const s of drop) {
      for (const p of s.preds) p.succs = p.succs.filter((x) => x !== s);
      for (const n of s.succs) n.preds = n.preds.filter((x) => x !== s);
      s.preds = [];
      s.succs = [];
    }
  }

  const live = new Set(tracks.flatMap((t) => t.steps));
  const liveSteps = steps.filter((s) => live.has(s));
  liveSteps.forEach((s, i) => (s.idx = i));
  return { townHall: th, tracks, steps: liveSteps, settings };
}

function link(pred: Step, succ: Step) {
  // An upgrade that's already running has nothing left to wait for.
  if (succ.inProgress || succ.preds.includes(pred)) return;
  pred.succs.push(succ);
  succ.preds.push(pred);
}
