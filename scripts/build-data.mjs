// Builds src/data/gamedata.json from ClashKing's static game data.
//
// Usage:
//   node scripts/build-data.mjs                 # download the latest data
//   node scripts/build-data.mjs path/to/static_data.json
//
// The source data uses the same numeric IDs as the in-game village export, so
// the export can be matched against it directly.
import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL =
  "https://raw.githubusercontent.com/clashkinginc/clashy.go/HEAD/static/static_data.json";

async function loadSource() {
  const path = process.argv[2];
  if (path) return JSON.parse(await readFile(path, "utf8"));
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return res.json();
}

const raw = await loadSource();
const buildingIdByName = Object.fromEntries(
  raw.buildings.filter((b) => b.village === "home").map((b) => [b.name, b._id]),
);

const HERO_HALL = buildingIdByName["Hero Hall"];
const TOWN_HALL = buildingIdByName["Town Hall"];

const entities = {};

// Buildings and traps: `build_time` on level L is the time to reach L.
function addStructure(src, kind) {
  if (!src.levels?.length) return;
  const levels = src.levels.map((l) => ({ th: l.required_townhall, time: l.build_time ?? 0 }));
  const merge = src.levels[0].merge_requirement;
  entities[src._id] = {
    id: src._id,
    name: src.name,
    kind,
    group: kind === "trap" ? "Trap" : src.type,
    levels,
    ...(merge && {
      merge: Object.values(
        merge.reduce((acc, m) => {
          acc[m._id] ??= { id: m._id, level: m.level, count: 0 };
          acc[m._id].count++;
          return acc;
        }, {}),
      ),
    }),
  };
}

for (const b of raw.buildings) {
  if (b.village !== "home") continue;
  if (b.type === "Wall" || b.type === "Town Hall") continue; // walls are instant; TH handled separately
  addStructure(b, "building");
}
for (const t of raw.traps) {
  if (t.village !== "home") continue;
  addStructure(t, "trap");
}

// Heroes and guardians (builder upgrades; lab research and pets aren't planned).
// Entry L holds stats/requirements for level L and the cost/time to go
// from L to L+1, so the time to *reach* L lives on entry L-1.
function addUnit(src, kind, group, reqKey, reqBuilding) {
  if (!src.levels?.length) return;
  const levels = src.levels.map((l, i) => ({
    th: l.required_townhall,
    time: i === 0 ? 0 : src.levels[i - 1].upgrade_time ?? 0,
    ...(reqKey && l[reqKey] != null && { req: l[reqKey] }),
  }));
  const unlockBuilding = buildingIdByName[src.production_building];
  entities[src._id] = {
    id: src._id,
    name: src.name,
    kind,
    group,
    levels,
    ...(reqBuilding && { reqBuilding }),
    ...(unlockBuilding && {
      unlockBuilding,
      unlockBuildingLevel: src.production_building_level ?? 1,
    }),
  };
}

for (const h of raw.heroes) {
  if (h.village !== "home") continue;
  addUnit(h, "hero", "Hero", "required_hero_tavern_level", HERO_HALL);
}
for (const g of raw.guardians ?? []) {
  addUnit(g, "guardian", "Guardian");
}

// Town Hall: per-level unlock counts, weapon upgrade times, and buildings that
// merge into the Town Hall (e.g. the Eagle Artillery at TH17) and so disappear.
const th = raw.buildings.find((b) => b._id === TOWN_HALL);
const unlocks = {};
const weapons = {};
const merges = {};
const running = {};
for (const l of th.levels) {
  for (const u of l.unlocks ?? []) running[u._id] = (running[u._id] ?? 0) + u.quantity;
  unlocks[l.level] = { ...running };
  if (l.merge_requirement?.length) {
    merges[l.level] = l.merge_requirement.map((m) => ({ id: m._id, level: m.level }));
  }
  if (l.weapon?.levels?.length) {
    weapons[l.level] = { name: l.weapon.name, times: l.weapon.levels.map((w) => w.build_time ?? 0) };
  }
}

// Helpers (levelled up instantly with gems). Builder's Apprentice and Lab Assistant: once a day,
// for `boost_time_seconds`, the assigned upgrade or research gets `boost_multiplier` extra seconds per second.
const helpers = {};
for (const h of raw.helpers ?? []) {
  if (!h.levels?.some((l) => l.boost_multiplier)) continue; // the Alchemist doesn't speed anything up
  helpers[h._id] = {
    id: h._id,
    name: h.name,
    levels: h.levels.map((l) => ({
      th: l.required_townhall,
      seconds: l.boost_time_seconds,
      multiplier: l.boost_multiplier,
    })),
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  source: SOURCE_URL,
  townHall: { id: TOWN_HALL, maxLevel: th.levels.length, unlocks, weapons, merges },
  entities,
  helpers,
};

await writeFile(new URL("../src/data/gamedata.json", import.meta.url), JSON.stringify(out));
console.log(
  `Wrote ${Object.keys(entities).length} entities (TH max ${th.levels.length}) to src/data/gamedata.json`,
);
