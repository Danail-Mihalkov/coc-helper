import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseExport } from "./parseExport";
import { buildPlan, defaultSettings, GOLD_PASS_BOOST, TH_WEAPON_KEY, type Plan, type Step, type Track } from "./plan";
import { schedule } from "./scheduler";

const DAY = 86400;
const sample = readFileSync("public/sample-export.json", "utf8");

describe("parseExport", () => {
  test("reads tag, Town Hall, builders and counts", () => {
    const v = parseExport(sample);
    expect(v.tag).toBe("#SAMPLE123");
    expect(v.townHall).toBe(17);
    expect(v.builders).toBe(6); // 5 huts + B.O.B
    expect(v.items.find((i) => i.id === 1000000)?.count).toBe(4); // Army Camps
  });

  test("ignores Builder Base sections and adjusts timers for export age", () => {
    const text = JSON.stringify({
      tag: "#X",
      timestamp: 1000,
      buildings: [
        { data: 1000001, lvl: 15 },
        { data: 1000008, lvl: 10, timer: 5000 },
      ],
      buildings2: [{ data: 1000008, lvl: 3, cnt: 9 }],
    });
    const v = parseExport(text, 3000);
    expect(v.items).toEqual([{ id: 1000008, level: 10, count: 1, timer: 3000 }]);
  });

  test("rejects garbage", () => {
    expect(() => parseExport("nope")).toThrow();
    expect(() => parseExport(JSON.stringify({ buildings: [] }))).toThrow(/Town Hall/);
  });
});

/** Hand-built plan: each track is a list of level durations in days. */
function manualPlan(builders: number, chains: Record<string, number[]>): Plan {
  const steps: Step[] = [];
  const tracks: Track[] = Object.entries(chains).map(([name, days]) => {
    const track: Track = {
      key: name, itemKey: name, name, group: "Defense", instance: 1,
      isNew: false, excluded: false, from: 0, to: days.length, steps: [], notes: [],
    };
    days.forEach((d, i) => {
      const s: Step = { idx: steps.length, track, level: i + 1, duration: d * DAY, inProgress: false, preds: [], succs: [] };
      const prev = track.steps[i - 1];
      if (prev) { prev.succs.push(s); s.preds.push(prev); }
      steps.push(s);
      track.steps.push(s);
    });
    return track;
  });
  return { townHall: 17, tracks, steps, settings: { builders, goldPass: false, excluded: [] } };
}

describe("schedule", () => {
  test("starts the long multi-level building first so everything ends together", () => {
    // A low Wizard Tower needs 8 levels (20 days); the others are one-offs.
    const plan = manualPlan(2, {
      "Wizard Tower": [1, 1, 2, 2, 3, 3, 4, 4],
      "Ricochet Cannon": [7],
      "X-Bow": [7],
      "Air Defense": [6],
    });
    const s = schedule(plan);
    const wt = s.tracks.find((t) => t.track.name === "Wizard Tower")!;
    expect(wt.timeToMax).toBe(20 * DAY);
    expect(wt.start).toBe(0);
    expect(s.finish).toBe(20 * DAY); // optimal: max(20, 40 / 2)
  });

  test("sample village: every step scheduled once, near the lower bound", () => {
    const v = parseExport(sample);
    const s = schedule(buildPlan(v, defaultSettings(v)));
    expect(new Set(s.order).size).toBe(s.plan.steps.length);
    for (const step of s.plan.steps) {
      for (const p of step.preds) expect(step.start!).toBeGreaterThanOrEqual(p.end!);
    }
    expect(s.finish).toBeLessThan(s.lowerBound * 1.03);
  });

  test("no builder ever runs two upgrades at once", () => {
    const v = parseExport(sample);
    const s = schedule(buildPlan(v, defaultSettings(v)));
    const lanes = new Map<number, Step[]>();
    for (const step of s.order) {
      if (step.duration === 0) continue;
      lanes.set(step.slot!, [...(lanes.get(step.slot!) ?? []), step]);
    }
    for (const lane of lanes.values()) {
      lane.sort((a, b) => a.start! - b.start!);
      for (let i = 1; i < lane.length; i++) expect(lane[i].start!).toBeGreaterThanOrEqual(lane[i - 1].end!);
    }
  });

  test("Gold Pass cuts every not-yet-started upgrade by 17%", () => {
    const v = parseExport(sample);
    const base = buildPlan(v, defaultSettings(v));
    const boosted = buildPlan(v, { ...defaultSettings(v), goldPass: true });
    base.steps.forEach((s, i) => {
      const b = boosted.steps[i];
      expect(b.duration).toBe(s.inProgress ? s.duration : Math.round(s.duration * (1 - GOLD_PASS_BOOST)));
    });
  });

  test("only builder upgrades are planned (no lab or pets)", () => {
    const v = parseExport(sample);
    const plan = buildPlan(v, defaultSettings(v));
    const kinds = new Set(plan.tracks.map((t) => t.entity?.kind ?? "weapon"));
    for (const k of kinds) expect(["building", "trap", "hero", "guardian", "weapon"]).toContain(k);
    expect(plan.tracks.some((t) => t.name === "Laboratory")).toBe(true); // the building itself still needs builders
    expect(plan.tracks.some((t) => t.name === "Barbarian" || t.name === "L.A.S.S.I")).toBe(false);
  });

  test("the Eagle Artillery merges into the TH17 Town Hall and is gone from then on", () => {
    const EAGLE = 1000031;
    const withEagle = (th: number, lvl: number) => {
      const j = JSON.parse(sample);
      j.buildings = j.buildings.filter((b: { data: number }) => b.data !== EAGLE);
      j.buildings.push({ data: EAGLE, lvl, cnt: 1 });
      j.buildings.find((b: { data: number }) => b.data === 1000001).lvl = th;
      const v = parseExport(JSON.stringify(j));
      return buildPlan(v, defaultSettings(v)).tracks.filter((t) => t.entity?.id === EAGLE);
    };
    expect(withEagle(17, 5)).toHaveLength(0);
    const th16 = withEagle(16, 5);
    expect(th16).toHaveLength(1);
    expect(th16[0].to).toBe(7);
    expect(th16[0].notes.join()).toMatch(/Merges into the Town Hall at TH17/);
  });
});

describe("include / exclude", () => {
  const v = parseExport(sample);
  const MORTAR = "1000013";
  const WIZARD_TOWER = "1000011";
  const HERO_HALL = "1000071";
  const QUEEN = "28000001";

  test("excluded buildings disappear from the plan", () => {
    const plan = buildPlan(v, { ...defaultSettings(v), excluded: [MORTAR, TH_WEAPON_KEY] });
    expect(plan.tracks.some((t) => t.itemKey === MORTAR)).toBe(false);
    expect(plan.tracks.some((t) => t.itemKey === TH_WEAPON_KEY)).toBe(false);
    const full = schedule(buildPlan(v, defaultSettings(v)));
    const less = schedule(plan);
    expect(less.totalWork).toBeLessThan(full.totalWork);
  });

  test("an excluded building that's mid-upgrade still keeps its builder busy", () => {
    const plan = buildPlan(v, { ...defaultSettings(v), excluded: [WIZARD_TOWER] });
    const wt = plan.tracks.filter((t) => t.itemKey === WIZARD_TOWER);
    expect(wt).toHaveLength(1); // only the one with a timer
    expect(wt[0].excluded).toBe(true);
    expect(wt[0].steps.map((s) => s.inProgress)).toEqual([true]);
  });

  test("excluding the Hero Hall caps heroes at what the current Hall allows", () => {
    const plan = buildPlan(v, { ...defaultSettings(v), excluded: [HERO_HALL] });
    const queen = plan.tracks.find((t) => t.itemKey === QUEEN)!;
    const withHall = buildPlan(v, defaultSettings(v)).tracks.find((t) => t.itemKey === QUEEN)!;
    expect(queen.to).toBeLessThan(withHall.to);
    expect(queen.notes.join()).toMatch(/needs Hero Hall/);
  });
});
