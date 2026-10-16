<img src="assets/icon.svg" width="64" height="64" alt="">

# CoC Helper

A Clash of Clans builder planner. Paste your in-game village export and it tells you:

- **Time to max** for every building, trap and hero at your current Town Hall
  (all remaining levels back to back, e.g. a Wizard Tower 8 levels behind = 20 days, a Ricochet Cannon with one level left = 7 days).
- **What to start next** on each builder, so everything finishes as close to the same day as possible.
- **Start by**: the latest date you can begin each item and still finish on time.
- A per-builder **timeline** of the whole plan.

You choose what goes into the plan. You can include or leave out whole groups (Defenses, Traps, Resources, Army buildings, Builder's Huts,
Heroes, Guardians) or individual buildings and heroes (e.g. skip Mortars and Hidden Teslas). An excluded building that's already upgrading
still keeps its builder busy until that upgrade finishes. Excluding the Hero Hall caps heroes at what your current Hall allows.

**Gold Pass**: one on/off switch that applies a 17% time reduction. The boost is nominally 20%, but because you unlock it partway through
the season, 17% is what you realistically get. Lab research and pets are not planned.

Created in [T3 Code](https://t3.codes).

## Usage

```sh
npm install
npm run dev        # http://localhost:5173
```

In game: **Settings → More Settings → Data Export → Copy**, then paste the JSON into the app (or upload it as a file) together
with your player tag. Villages are saved in your browser's localStorage. Click **Try sample** to see a demo village.

## How the plan is built

Every upgrade level is a step. The steps for one building form a chain, because you can't upgrade two levels of the same
building at once. Some steps also wait on another upgrade: hero levels need a Hero Hall level, and merged defenses (Ricochet Cannon, Multi-Archer Tower, …)
need their source buildings at the merge level. Buildings merged into the Town Hall itself (the Eagle Artillery at TH17)
are left out from that Town Hall on; at TH16 the Eagle is flagged as needing max level before the Town Hall upgrade.

The planner uses critical-path list scheduling. Whenever a builder is free, it takes the ready step with the most work still
waiting behind it. That puts long chains first and lets short upgrades fill the gaps. The summary compares the result with the theoretical best,
`max(longest chain, total work / builders)`.

## Game data

`src/data/gamedata.json` is generated from [ClashKing's static data](https://github.com/clashkinginc/clashy.go/tree/main/static),
which uses the same IDs as the in-game export. The file is bundled into the app as-is: nothing is fetched at runtime or on a
schedule. It only changes when you refresh it yourself, e.g. after a game update:

```sh
npm run update-data
```

## Known limitations

- Walls and hero equipment have no build time, so they aren't scheduled.
- Lab research and pets are not planned (the Laboratory and Pet House *buildings* are, since they use builders).
- Crafting Station modules and supercharges are ignored.
- Guardians (TH18) are assumed to use builders.
- Goblin Builder / Builder's Apprentice / potions aren't modelled.

## Scripts

| Command               | What it does                     |
| --------------------- | -------------------------------- |
| `npm run dev`         | Dev server                       |
| `npm run build`       | Type-check and production build  |
| `npm test`            | Planner and parser tests         |
| `npm run update-data` | Re-download and compact game data |
